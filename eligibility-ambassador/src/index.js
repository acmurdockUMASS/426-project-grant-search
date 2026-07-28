import express, { response } from "express";
import { randomUUID } from "node:crypto";

const app = express();

const PORT = process.env.PORT || 3000;
const UPSTREAM_URL =
  process.env.UPSTREAM_URL || "http://eligibility-analysis-service:3000";

app.use(express.json());

app.get("/health", (req, res) => {
  response.json({
    status: "ok",
    service: "eligibility-ambassador",
    upstream: UPSTREAM_URL,
  });
});
