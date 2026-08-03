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
