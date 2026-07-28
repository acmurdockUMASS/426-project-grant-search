import express from "express";
import { randomUUID } from "node:crypto";
const app = express();

const PORT = process.env.PORT || 3000;
const UPSTREAM_URL =
  process.env.UPSTREAM_URL || "http://eligibility-service:3000";

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "eligibility-ambassador",
    upstream: UPSTREAM_URL,
  });
});

async function forwardRequest(req, res, upstreamPath) {
  try {
    const upstreamResponse = await fetch(UPSTREAM_URL + upstreamPath, {
      method: req.method,
      headers: { "content-type": "application/json" },
      body: req.method === "POST" ? JSON.stringify(req.body) : undefined,
    });

    res.status(upstreamResponse.status).json(await upstreamResponse.json());
  } catch {
    res.status(502).json({
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
});
