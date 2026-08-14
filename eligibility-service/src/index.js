import express from "express";
import { randomUUID } from "node:crypto";
import promClient from "prom-client";

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = process.env.DATA_DIR || "./data";
const MIN_LATENCY_MS = process.env.MIN_LATENCY_MS || 350;
const MAX_LATENCY_MS = process.env.MAX_LATENCY_MS || 900;

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
      service: "eligibility-analysis-service",
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

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function getLatency() {
  const range = MAX_LATENCY_MS - MIN_LATENCY_MS + 1;
  return MIN_LATENCY_MS + Math.floor(Math.random() * range);
}

function normalize(value) {
  return String(value).trim().toLowerCase();
}

function normList(values) {
  return values.map((value) => normalize(value));
}

function requestHasCorrectFields(organization, grant) {
  if (!organization || !grant) {
    return false;
  }

  const organizationIsValid =
    typeof organization.id === "string" &&
    typeof organization.name === "string" &&
    typeof organization.entityType === "string" &&
    typeof organization.state === "string" &&
    typeof organization.annualBudget === "number" &&
    typeof organization.yearsOperating === "number" &&
    Array.isArray(organization.missionAreas);

  const grantIsValid =
    typeof grant.id === "string" &&
    typeof grant.title === "string" &&
    Array.isArray(grant.eligibleEntityTypes) &&
    Array.isArray(grant.eligibleStates) &&
    typeof grant.minimumAnnualBudget === "number" &&
    typeof grant.maximumAnnualBudget === "number" &&
    typeof grant.minimumYearsOperating === "number" &&
    Array.isArray(grant.focusAreas);

  return organizationIsValid && grantIsValid;
}

app.get("/health", (request, response) => {
  response.json({
    status: "ok",
    service: "eligibility-analysis-service",
  });
});

app.post("/eligibility-checks", async (request, response) => {
  const { organization, grant } = request.body;

  if (!requestHasCorrectFields(organization, grant)) {
    return response.status(400).json({
      error: "Invalid request",
      message:
        "The request must include an organization and a grant with all required fields.",
    });
  }

  if (grant.maximumAnnualBudget < grant.minimumAnnualBudget) {
    return response.status(400).json({
      error: "Invalid budget range",
      message:
        "maximumAnnualBudget must be greater than or equal to minimumAnnualBudget.",
    });
  }
  const eligibleEntityTypes = normList(grant.eligibleEntityTypes);
  const eligibleStates = normList(grant.eligibleStates);
  const organizationMissionAreas = normList(organization.missionAreas);
  const grantFocusAreas = normList(grant.focusAreas);

  const matchingMissionAreas = organizationMissionAreas.filter((missionArea) =>
    grantFocusAreas.includes(missionArea),
  );
  const checks = [
    {
      name: "Entity type",
      passed: eligibleEntityTypes.includes(normalize(organization.entityType)),
      organizationValue: organization.entityType,
      grantRequirement: grant.eligibleEntityTypes,
    },
    {
      name: "State",
      passed:
        eligibleStates.includes("nationwide") ||
        eligibleStates.includes(normalize(organization.state)),
      organizationValue: organization.state,
      grantRequirement: grant.eligibleStates,
    },
    {
      name: "Annual budget",
      passed:
        organization.annualBudget >= grant.minimumAnnualBudget &&
        organization.annualBudget <= grant.maximumAnnualBudget,
      organizationValue: organization.annualBudget,
      grantRequirement: {
        minimum: grant.minimumAnnualBudget,
        maximum: grant.maximumAnnualBudget,
      },
    },
    {
      name: "Years operating",
      passed: organization.yearsOperating >= grant.minimumYearsOperating,
      organizationValue: organization.yearsOperating,
      grantRequirement: grant.minimumYearsOperating,
    },
    {
      name: "Mission area",
      passed: matchingMissionAreas.length > 0,
      organizationValue: organization.missionAreas,
      grantRequirement: grant.focusAreas,
      matches: matchingMissionAreas,
    },
  ];

  const passedChecks = checks.filter((check) => check.passed).length;
  const eligible = passedChecks === checks.length;
  const matchScore = Math.round((passedChecks / checks.length) * 100);

  const simulatedLatencyMs = getLatency();
  await wait(simulatedLatencyMs);
  const result = {
    eligibilityCheckId: randomUUID(),
    organizationId: organization.id,
    organizationName: organization.name,
    grantId: grant.id,
    grantTitle: grant.title,
    eligible,
    matchScore,
    passedChecks,
    totalChecks: checks.length,
    checks,
    simulated: true,
    simulatedLatencyMs,
    checkedAt: new Date().toISOString(),
    message: eligible
      ? "the organization appears eligible based on simulated requirements"
      : "The organization did not pass every requirement",
  };
  writeLog("info", "Eligibility check completed", {
    eligibilityCheckId: result.eligibilityCheckId,
    simulatedLatencyMs,
  });
  response
    .set("x-simulated-latency-ms", String(simulatedLatencyMs))
    .json(result);
});

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", metricsRegistry.contentType);
  res.end(await metricsRegistry.metrics());
});

app.use((req, res) => {
  res.status(404).json({
    error: "Not found",
    message: "Use GET /health or POST /eligibility-checks.",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  writeLog("info", "Eligibility Analysis Service started", {
    port: Number(PORT),
  });
});