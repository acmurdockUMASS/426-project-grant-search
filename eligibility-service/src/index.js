import express, { response } from "express";
import { randomUUID } from "node:crypto";

const PORT = process.env.PORT || 3001;
const DATA_DIR = process.env.DATA_DIR || "./data";
const MIN_LATENCY_MS = process.env.MIN_LATENCY_MS || 350;
const MAX_LATENCY_MS = process.env.MAX_LATENCY_MS || 900;

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

  const matchingMissionAreas = organizationMissionAreas.filter((missionAreas) =>
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
  const matchScore = Math.round((passedChecks / check.length) * 100);

  const simulatedLatencyMs = getRandomLatency();
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
  console.log(`${result.eligiblityCheckId} in ${simulatedLatencyMs} ms`);
  response
    .set("x-sumulated-latency-ms", String(simulatedLatencyMs))
    .json(result);
});

app.use((req, res) => {
  response.status(404).json({
    error: "Not found",
    message: "Use Get /health or POST /eligiblity-checks.",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`eligbility service is listening on port ${PORT}`);
});
