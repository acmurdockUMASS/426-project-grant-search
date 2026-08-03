import http from "k6/http";
import {check, sleep} from "k6";
import {Rate} from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const RUN_ELIGIBILITY = String(__ENV.RUN_ELIGIBILITY).toLowerCase() === "true";

const cacheHitRate = new Rate("cache_hit_rate");
const cacheHeaderValid = new Rate("cache_header_valid");
const servedByHeaderPresent = new Rate("served_by_header_present");

const scenarios = {
    grant_search:{
     executor: "constant-vus",
     exec: "grantSearchWorkload",
     vus: 10,
     duration: "45s",
     gracefulStop: "5s",
  },
};


const thresholds = {
  "http_req_duration{endpoint:grants}": ["p(95)<500"],
  "http_req_failed{endpoint:grants}": ["rate<0.005"],
  checks: ["rate>0.99"],
  cache_header_valid: ["rate>0.99"],
  cache_hit_rate: ["rate>0.50", "rate<0.95"],
  served_by_header_present: ["rate>0.99"],
};

if (RUN_ELIGIBILITY){
    scenarios.eligibility = {
        executor: "constant-vus",
        exec: "eligibilityWorkload",
        vus: 2,
        duration: "45s",
        gracefulStop: "5s",
    };
    thresholds["http_req_duration{endpoint:eligibility}"] = ["p(95)<2000",];
    thresholds["http_req_failed{endpoint:eligibility}"] = ["rate<0.01",];
}

export const options = {
    scenarios,
    thresholds,
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
  "/grants?grantStatus=Ongoing",
  "/grants?orgQueryRegion=Massachusetts",
  "/grants?orgQueryInterests=environment",
];

const eligibilityPayload = {  
    organization: {
    id: "org-100",
    name: "Northfield Community Education",
    entityType: "501(c)(3)",
    state: "Massachusetts",
    annualBudget: 250000,
    yearsOperating: 5,
    missionAreas: ["education", "community"],
  },
  grant: {
    id: "grant-100",
    title: "Massachusetts Education Support Grant",
    eligibleEntityTypes: ["501(c)(3)"],
    eligibleStates: ["Massachusetts"],
    minimumAnnualBudget: 50000,
    maximumAnnualBudget: 500000,
    minimumYearsOperating: 2,
    focusAreas: ["education"],
  },
};


const getHeader = (response, headerName) => {
    const expectedName = headerName.toLowerCase();

    const matchingHeader = Object.entries(response.headers).find(
        ([name]) => name.toLowerCase() === expectedName,
    );
    return matchingHeader ? matchingHeader[1]: "";
};

export const grantSearchWorkload = () => {
    const useHotQuery = Math.random() < 0.75; 

    let path;
    
    if (useHotQuery){
        const queryIndex = Math.floor(Math.random() * hotQueries.length);
        path = hotQueries[queryIndex];
    }
    else{
        const uniqueMinimumAmount = 1000 + _VU * 1000 + __ITER; 
        path = `/grants?amountRangeLow=${uniqueMinimumAmount}`;
    }

    const response = http.get(`${BASE_URL}${path}`, {
        tags: {
            endpoint: "grants",
            queryType: useHotQuery ? "hot" : "cold",
        },
    });
    
    const cacheHeader = String(getHeader(response, "x-cache"),
    ).toUpperCase();

    const servedBy = getHeader(response, "x-served-by"); 

    const cacheHeaderIsValid = cacheHeader === "HIT" || cacheHeader === "MISS"; 

    cacheHeaderValid.add(cacheHeaderIsValid);
    cacheHitRate.add(cacheHeader === "HIT");
    servedByHeaderPresent.add(servedBy.length > 0);

    check(response, {
        "grant search returned 200": (result) => result.status === 200, 
        "grant response contains matches" : (result) => {
            try {
                const body = result.json();
                return Array.isArray(body.matches);
            }
            catch{
                return false;
            }
        },
        "Cache header is present": () => cacheHeaderIsValid,

        "replica header is present": () => servedBy.length > 0,

    });

    sleep(0.2);
};

export const eligibilityWorkload = () => {
    const response = http.post(`{BASE_URL}/eligibility-checks`,
        JSON.stringify(eligibilityPayload), 
        {
            headers: {
                "content-type": "application/json",
            },
            tags: {
                endpoint: "eligibility",
            },
        },
    );

  check(response, {
    "eligibility returned 200": (result) => result.status === 200,

    "eligibility returned five checks": (result) => {
      try {
        return result.json().checks.length === 5;
      } catch {
        return false;
      }
    },

    "eligibility returned matchScore": (result) => {
      try {
        return typeof result.json().matchScore === "number";
      } catch {
        return false;
      }
    },

    "latency header survived proxy chain": (result) =>
      getHeader(result, "x-simulated-latency-ms").length > 0,
  });

  sleep(0.2);
};
