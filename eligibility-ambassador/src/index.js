import express from "express";
import promClient from "prom-client";

const app = express();

const PORT = process.env.PORT || 3000;
const UPSTREAM_URL =
  process.env.UPSTREAM_URL || "http://eligibility-service:3000";

const timeoutFromEnvironment = Number(process.env.UPSTREAM_TIMEOUT_MS);

const UPSTREAM_TIMEOUT_MS = Number.isFinite(timeoutFromEnvironment) && timeoutFromEnvironment > 0 ? timeoutFromEnvironment : 1500; 

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

function writeLog(level, message, details = {}) {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      service: "eligibility-ambassador",
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

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "eligibility-ambassador",
    upstream: UPSTREAM_URL,
    upstreamTimeoutMs: UPSTREAM_TIMEOUT_MS,
  });
});

async function forwardRequest(req, res, upstreamPath) {
  try {
    const requestHasBody = ["POST", "PUT", "PATCH"].includes(req.method);

    const upstreamResponse = await fetch(UPSTREAM_URL + upstreamPath, {
      method: req.method,
      headers: {
        "content-type": "application/json",
      },
      body: requestHasBody ? JSON.stringify(req.body) : undefined,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    const upstreamContentType =
      upstreamResponse.headers.get("content-type") || "application/json";

    const simulatedLatency =
      upstreamResponse.headers.get("x-simulated-latency-ms");

    if (simulatedLatency) {
      res.set("x-simulated-latency-ms", simulatedLatency);
    }

    const upstreamBody = await upstreamResponse.text();

    res.status(upstreamResponse.status);
    res.set("content-type", upstreamContentType);

    return res.send(upstreamBody);
  } catch (error) {
    writeLog("error", "Eligibility upstream request failed", {
      error: error.message,
      upstreamPath,
    });

    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return res.status(504).json({
        error: "Eligibility service timed out",
        timeoutMs: UPSTREAM_TIMEOUT_MS,
      });
    }

    return res.status(502).json({
      error: "Eligibility service unavailable",
    });
  }
}

app.get("/eligibility-service/health", (req, res) => {
  forwardRequest(req, res, "/health");
});

app.post("/eligibility-checks", (req, res) => {
  forwardRequest(req, res, "/eligibility-checks");
});

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", metricsRegistry.contentType);
  res.end(await metricsRegistry.metrics());
});

app.use((req, res) => {
  res.status(404).json({
    error: "Not found",
    message:
      "Use GET /health, GET /eligibility-service/health, or POST /eligibility-checks.",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  writeLog("info", "Eligibility Ambassador started", {
    port: Number(PORT),
    upstreamUrl: UPSTREAM_URL,
    upstreamTimeoutMs: UPSTREAM_TIMEOUT_MS,
  });
});