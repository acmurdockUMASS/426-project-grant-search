import express from "express";
import amqp from "amqplib";
import promClient from "prom-client";

const PORT = process.env.PORT || 3000;
const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://rabbitmq:5672";
const GRANT_ALERT_QUEUE = process.env.GRANT_ALERT_QUEUE || "grant-alert-jobs";
const PROCESSING_DELAY_MS = process.env.PROCESSING_DELAY_MS || 250;

const app = express();

let rabbitReady = false;

const delay = (ms) => new Promise((resolve)=>setTimeout(resolve,ms));

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

function writeConsumerLog(event, details = {}, level = "info") {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message: event.replaceAll("_", " "),
      service: "grant-alert-worker",
      component: "consumer",
      event,
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

    writeConsumerLog(
      "http_request_completed",
      {
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        responseTimeMs,
      },
      res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
    );
  });

  next();
});

async function processGrantAlert(message, channel) {
  if (!message) {
    return;
  }

  let job;

  try {
    job = JSON.parse(message.content.toString("utf8"));
  } catch (error) {
    writeConsumerLog("rejected", {
      reason: "invalid_json",
      message: error.message,
    }, "warn");

    channel.nack(message, false, false);
    return;
  }

  const jobDetails = {
    jobId: job.jobId,
    organizationId: job.organizationId,
    grantId: job.grantId,
    alertType: job.alertType,
  };

  writeConsumerLog("picked_up", {
    ...jobDetails,
    queue: GRANT_ALERT_QUEUE,
  });

  try {
    await delay(PROCESSING_DELAY_MS);

    writeConsumerLog("processed", {
      ...jobDetails,
      processingDelayMs: PROCESSING_DELAY_MS,
    });

    channel.ack(message);
  } catch (error) {
    writeConsumerLog("processing_failed", {
      ...jobDetails,
      message: error.message,
    }, "error");

    try {
      channel.nack(message, false, true);
    } catch {
      writeConsumerLog("requeue_failed", {
        jobId: job.jobId,
      }, "error");
    }
  }
}

async function startRabbitConsumer() {
  let connection;

  try {
    connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();

    await channel.assertQueue(GRANT_ALERT_QUEUE, {
      durable: true,
    });

    await channel.prefetch(1);

    await channel.consume(GRANT_ALERT_QUEUE, (message) => {
      void processGrantAlert(message, channel);
    });

    rabbitReady = true;

    connection.on("error", (error) => {
      writeConsumerLog("rabbitmq_error", {
        message: error.message,
      }, "error");
    });

    connection.on("close", () => {
      rabbitReady = false;
      writeConsumerLog("rabbitmq_disconnected");
      setTimeout(() => void startRabbitConsumer(), 2000);
    });

    writeConsumerLog("waiting_for_messages", {
      queue: GRANT_ALERT_QUEUE,
      prefetch: 1,
    });
  } catch (error) {
    rabbitReady = false;

    writeConsumerLog("rabbitmq_connection_failed", {
      message: error.message,
    }, "error");

    await connection?.close().catch(() => {});
    setTimeout(() => void startRabbitConsumer(), 2000);
  }
}

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", metricsRegistry.contentType);
  res.end(await metricsRegistry.metrics());
});

//GET /health
app.get("/health", (req, res) => {
  if (!rabbitReady) {
    return res.status(503).json({
      status: "starting",
    });
  }

  return res.json({
    status: "ok",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  writeConsumerLog("started", { port: Number(PORT) });
});

void startRabbitConsumer();