import express from "express";
import { randomUUID } from "node:crypto";
const app = express();

const PORT = process.env.PORT || 3000;
const UPSTREAM_URL =
  process.env.UPSTREAM_URL || "http://eligibility-service:3000";

const timeoutFromEnvironment = Number(process.env.UPSTREAM_TIMEOUT_MS);

const UPSTREAM_TIMEOUT_MS = Number.isFinite(timeoutFromEnvironment) && timeoutFromEnvironment > 0 ? timeoutFromEnvironment : 1500; 

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

app.use((req, res) => {
  res.status(404).json({
    error: "Not found",
    message:
      "Use GET /health, GET /eligibility-service/health, or POST /eligibility-checks.",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Eligibility Ambassador is listening on port ${PORT}`);
  console.log(`Forwarding requests to ${UPSTREAM_URL}`);
  console.log(`Upstream timeout is ${UPSTREAM_TIMEOUT_MS} ms`);
});
