import express from "express";
import crypto from "node:crypto";
import amqp from "amqplib";
import { createClient} from "redis";
import promClient from "prom-client";

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || "./data";
const INSTANCE_ID = process.env.INSTANCE_ID || "grant-search";
const ELIGIBILITY_AMBASSADOR_URL = process.env.ELIGIBILITY_AMBASSADOR_URL || "http://eligibility-ambassador:3000";
const RABBITMQ_URL =
  process.env.RABBITMQ_URL ||
  "amqp://grantsearch:grantsearch-dev@rabbitmq:5672";
const GRANT_ALERT_QUEUE = process.env.GRANT_ALERT_QUEUE || "grant-alert-jobs";
const FAULT = process.env.FAULT || 0;

const metricsRegistry = new promClient.Registry();

const httpRequestsTotal = new promClient.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests received",
  labelNames: ["method", "route", "status_code"],
  registers: [metricsRegistry],
});

const httpRequestDuration = new promClient.Histogram({
  name: "http_request_duration_milliseconds",
  help: "HTTP request duration in milliseconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2000, 5000],
  registers: [metricsRegistry],
});

const app = express();

function writeLog(level, message, details = {}) {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      service: "grant-search-service",
      instanceId: INSTANCE_ID,
      ...details,
    }),
  );
}

app.use((req, res, next) => {
  const startedAt = performance.now();

  res.on("finish", () => {
    const responseTimeMs = Number((performance.now() - startedAt).toFixed(2));
    const route = req.route?.path || req.path;
    const statusCode = String(res.statusCode);

    httpRequestsTotal.inc({
      method: req.method,
      route,
      status_code: statusCode,
    });
    httpRequestDuration.observe(
      {
        method: req.method,
        route,
        status_code: statusCode,
      },
      responseTimeMs,
    );

    writeLog(
      res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
      "HTTP request completed",
      {
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        responseTimeMs,
      },
    );
  });

  next();
});

app.use(express.json());

const grants = [
{ name: "Massachusetts Education Grant Opportunities for Student Success",
grantId: "13333",
deadlineStatus: "Ongoing",
fundingAmount: 10000,
regions: ["Massachusetts"],
requirements: ["501(c)(3)"],
interests: ["education"],
description: "Grant Opportunities to support educational improvement efforts across Massachusetts."},
{ name: "United States Humanitarian Grants",
grantId: "78641",
deadlineStatus: "Closed",
fundingAmount: 50000,
regions: ["United States"],
requirements: ["individual"],
interests: ["health", "humanities", "environment"],
description: "Grant Opportunities to support educational improvement efforts across Massachusetts."},
{ name: "North East Clean Up Grants",
grantId: "56733",
deadlineStatus: "Ongoing",
fundingAmount: 3000,
regions: ["Maine", "Vermont", "New Hampshire"],
requirements: ["501(c)(3)", "individual"],
interests: ["environment"],
description: "Grant Opportunities to help clean up areas underneath the Northeast Wilderness Trust."},
];

const delay = (ms) => new Promise((resolve)=>setTimeout(resolve,ms));


const redisClient = createClient({ url: process.env.REDIS_URL});
redisClient.on("error", (error) => {
  writeLog("error", "Redis client error", {
    error: error.message,
  });
});
await redisClient.connect();


let rabbitConnection;
let rabbitChannel;
let rabbitConnectInProgress = false;
let rabbitReconnectTimer;


function writeProducerLog(event, details = {}, level = "info") {
    writeLog(level, `RabbitMQ producer ${event.replaceAll("_", " ")}`, {
      component: "producer",
      event,
      ...details,
    });
}


function scheduleRabbitReconnect(){
    if(rabbitReconnectTimer){
        return;
    }

    rabbitReconnectTimer = setTimeout(() => {
        rabbitReconnectTimer = undefined;
        void connectToRabbitMQ();
    }, 2000);
}

async function connectToRabbitMQ(){
    if (rabbitConnectInProgress || rabbitChannel){
       return;
    }

    rabbitConnectInProgress = true;
    let connection;
    try {
    connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createConfirmChannel();

    await channel.assertQueue(GRANT_ALERT_QUEUE, {
      durable: true,
    });

    rabbitConnection = connection;
    rabbitChannel = channel;

    connection.on("error", (error) => {
      writeProducerLog("rabbitmq_error", {
        message: error.message,
      }, "error");
    });

    connection.on("close", () => {
      if (rabbitConnection === connection) {
        rabbitConnection = undefined;
        rabbitChannel = undefined;

        writeProducerLog("rabbitmq_disconnected", {}, "warn");
        scheduleRabbitReconnect();
      }
    });

    writeProducerLog("rabbitmq_connected", {
      queue: GRANT_ALERT_QUEUE,
    });
  } catch (error) {
    writeProducerLog("rabbitmq_connection_failed", {
      message: error.message,
    }, "error");

    if (connection) {
      await connection.close().catch(() => {});
    }

    scheduleRabbitReconnect();
  } finally {
    rabbitConnectInProgress = false;
  }
}

void connectToRabbitMQ();

async function enqueueGrantAlert(job) {
  const channel = rabbitChannel;

  if (!channel) {
    throw new Error("RabbitMQ is not connected");
  }

  channel.sendToQueue(
    GRANT_ALERT_QUEUE,
    Buffer.from(JSON.stringify(job)),
    {
      persistent: true,
      contentType: "application/json",
      messageId: job.jobId,
      timestamp: Date.now(),
    },
  );

  await channel.waitForConfirms();

  writeProducerLog("enqueued", {
    jobId: job.jobId,
    queue: GRANT_ALERT_QUEUE,
    organizationId: job.organizationId,
    grantId: job.grantId,
    alertType: job.alertType,
  });
}

function queryValueAsArray(value) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value.toSorted() : [value];
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isFaultActive() {
  return String(FAULT) === "1";
}
// Query Helper To Check for Query Parameters and ensure variables are arrays
const qHelper = (qIn) => {
    if(!qIn){return []} // No input is an empty array
    if(Array.isArray(qIn)){
        return qIn.toSorted();
    }else{
        let out = [];
        out.push(qIn);
        return out;
    }
}
//GET /health
app.get("/health", (req, res) => {
  const faultActive = isFaultActive();

  res.status(faultActive ? 503 : 200).json({
    status: faultActive ? "fault" : "ok",
    service: "grant-search-service",
    instanceId: INSTANCE_ID,
    rabbitmq: rabbitChannel ? "connected" : "connecting",
    faultSwitch: FAULT
  });
});
// GET /grants
app.get("/grants", async (req, res) => {
    if(isFaultActive()){
        writeLog("error", "Fault switch active on /grants");
        return res.status(500).json({
        error: "Fault Active.",
        });
        }
    const {
        grantStatus,
        amountRangeLow = 0,
        amountRangeHigh = Infinity,
        orgQueryRegion,
        orgQueryReq,
        orgQueryInterests,
    } = req.query;
    let orgRegion = qHelper(orgQueryRegion);
    let orgReq = qHelper(orgQueryReq);
    let orgInterests = qHelper(orgQueryInterests);

    // Check Cache
    const key = JSON.stringify({gS: grantStatus || null, aRL: amountRangeLow, aRH: amountRangeHigh,
        oQRG: orgQueryRegion, oQR: orgQueryReq, oQI: orgQueryInterests    
    });

    const value = await redisClient.get(key);
    if(value != null){
        res.setHeader('X-Cache', 'HIT');
        writeLog("info", "Grant search cache hit");
        return res.json(JSON.parse(value));
    }else{
        res.setHeader('X-Cache', 'MISS');
        writeLog("info", "Grant search cache miss");
        //Cache Miss Fetch Data
        await delay (450);
        const matches = grants.filter((grant) => {
            if(grantStatus && grant.deadlineStatus !== grantStatus){return false;}
            if(Number(amountRangeLow) > grant.fundingAmount){return false;}
            if(Number(amountRangeHigh) < grant.fundingAmount){return false;}
            if(orgRegion.length > 0 && 
            !orgRegion.some(region => grant.regions.includes(region))){return false;}
            if(orgReq.length > 0 && 
            !orgReq.some(req => grant.requirements.includes(req))){return false;}
            if(orgInterests.length > 0 && 
            !orgInterests.some(interest => grant.interests.includes(interest))){return false;}
            return true;
        });

        //Add to cache
        await redisClient.set(key, JSON.stringify({ count: matches.length, source: "cache", matches: matches }), {EX: 3600} );

        return res.json({ count: matches.length, source: "database", matches: matches });
    }
});

app.post("/grant-alerts", async (req, res) => {
  const {
    organizationId,
    organizationName,
    grantId,
    grantName,
    alertType,
  } = req.body;

  const requiredValues = [
    organizationId,
    organizationName,
    grantId,
    grantName,
    alertType,
  ];

  if (!requiredValues.every(isNonEmptyString)) {
    return res.status(400).json({
      error: "Invalid request",
      message:
        "organizationId, organizationName, grantId, grantName, and alertType are required strings.",
    });
  }

  const job = {
    jobId: crypto.randomUUID(),
    organizationId: organizationId.trim(),
    organizationName: organizationName.trim(),
    grantId: grantId.trim(),
    grantName: grantName.trim(),
    alertType: alertType.trim(),
    enqueuedAt: new Date().toISOString(),
  };

  try {
    await enqueueGrantAlert(job);

    return res.status(202).json({
      status: "queued",
      jobId: job.jobId,
      queue: GRANT_ALERT_QUEUE,
    });
  } catch (error) {
    writeProducerLog("enqueue_failed", {
      jobId: job.jobId,
      message: error.message,
    }, "error");

    return res.status(503).json({
      error: "Grant alert queue unavailable",
      message:
        "The search service is still available, but this alert could not be queued.",
    });
  }
});

    app.post("/eligibility-checks", async (req, res) => {
        if(isFaultActive()){
        writeLog("error", "Fault switch active on /eligibility-checks");
        return res.status(500).json({
        error: "Fault Active.",
        });
        }
        try {
            const ambassadorResponse = await fetch(
                `${ELIGIBILITY_AMBASSADOR_URL}/eligibility-checks`,{
                    method: "POST",
                    headers: {
                        "content-type":  "application/json", 
                    },
                    body: JSON.stringify(req.body),
                },
            );
    const upstreamContentType =
      ambassadorResponse.headers.get("content-type") ||
      "application/json";

    const simulatedLatency =
      ambassadorResponse.headers.get("x-simulated-latency-ms");

    const upstreamBody = await ambassadorResponse.text();

    if (simulatedLatency) {
      res.set("x-simulated-latency-ms", simulatedLatency);
    }

    res.status(ambassadorResponse.status);
    res.set("content-type", upstreamContentType);

    return res.send(upstreamBody);
  } catch (error) {
    writeLog("error", "Cannot reach Eligibility Ambassador", {
      error: error.message,
    });

    return res.status(502).json({
      error: "Eligibility Ambassador unavailable",
    });
  }
});

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", metricsRegistry.contentType);
  res.end(await metricsRegistry.metrics());
});

app.listen(PORT, "0.0.0.0", () => {
  writeLog("info", "Grant Search Service started", { port: Number(PORT) });
});
