import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

const cacheHitRate = new Rate("cache_hit_rate");
const cacheHeaderValid = new Rate("cache_header_valid");
const servedByHeaderPresent = new Rate("served_by_header_present");

export const options = {
  vus: 10,
  duration: "60s",
  thresholds: {
    "http_req_duration{endpoint:grants}": ["p(95)<500"],
    "http_req_failed{endpoint:grants}": ["rate<0.005"],
    checks: ["rate>0.99"],
    cache_header_valid: ["rate>0.99"],
    cache_hit_rate: ["rate>0.50", "rate<0.95"],
    served_by_header_present: ["rate>0.99"],
  },
  summaryTrendStats: [
    "avg",
    "min",
    "p(50)",
    "p(95)",
    "p(99)",
    "max",
  ],
};

const hotQueries = [
  {
    path: "/grants?grantStatus=Ongoing",
    expectedGrantIds: ["13333", "56733"],
  },
  {
    path: "/grants?orgQueryRegion=Massachusetts",
    expectedGrantIds: ["13333"],
  },
  {
    path: "/grants?orgQueryInterests=environment",
    expectedGrantIds: ["78641", "56733"],
  },
];

const getHeader = (response, headerName) => {
  const expectedName = headerName.toLowerCase();
  const matchingHeader = Object.entries(response.headers).find(
    ([name]) => name.toLowerCase() === expectedName,
  );

  return matchingHeader ? matchingHeader[1] : "";
};

const parseGrantMatches = (response) => {
  try {
    const body = response.json();
    return Array.isArray(body.matches) ? body.matches : undefined;
  } catch {
    return undefined;
  }
};

const grantSearchWorkload = () => {
  const useHotQuery = Math.random() < 0.75;
  const selectedQuery = useHotQuery
    ? hotQueries[Math.floor(Math.random() * hotQueries.length)]
    : undefined;

  const uniqueMinimumAmount = 1000 + __VU * 1000 + __ITER;
  const path = selectedQuery
    ? selectedQuery.path
    : `/grants?amountRangeLow=${uniqueMinimumAmount}`;

  const response = http.get(`${BASE_URL}${path}`, {
    tags: {
      endpoint: "grants",
      queryType: useHotQuery ? "hot" : "cold",
    },
  });

  const cacheHeader = String(getHeader(response, "x-cache")).toUpperCase();
  const servedBy = getHeader(response, "x-served-by");
  const cacheHeaderIsValid = cacheHeader === "HIT" || cacheHeader === "MISS";
  const returnedMatches = parseGrantMatches(response);
  const returnedGrantIds = Array.isArray(returnedMatches)
    ? returnedMatches.map((grant) => grant.grantId)
    : [];

  cacheHeaderValid.add(cacheHeaderIsValid);
  cacheHitRate.add(cacheHeader === "HIT");
  servedByHeaderPresent.add(servedBy.length > 0);

  check(response, {
    "grant search returned 200": (result) => result.status === 200,
    "grant response contains matches": () => Array.isArray(returnedMatches),
    "hot query returned expected grants": () =>
      !selectedQuery ||
      selectedQuery.expectedGrantIds.every((grantId) =>
        returnedGrantIds.includes(grantId),
      ),
    "cache header is present": () => cacheHeaderIsValid,
    "replica header is present": () => servedBy.length > 0,
  });

  sleep(0.2);
};

export default grantSearchWorkload;