# Sprint 5 Final Load Test


     execution: local
        script: .\load-tests\sprint-5-load.js
        output: -

     scenarios: (100.00%) 1 scenario, 10 max VUs, 1m30s max duration (incl. graceful stop):
              * default: 10 looping VUs for 1m0s (gracefulStop: 30s)



  █ THRESHOLDS 

    cache_header_valid
    ✓ 'rate>0.99' rate=100.00%

    cache_hit_rate
    ✓ 'rate>0.50' rate=84.15%
    ✓ 'rate<0.95' rate=84.15%

    checks
    ✓ 'rate>0.99' rate=100.00%

    http_req_duration{endpoint:grants}
    ✓ 'p(95)<500' p(95)=456.54ms

    http_req_failed{endpoint:grants}
    ✓ 'rate<0.005' rate=0.00%

    served_by_header_present
    ✓ 'rate>0.99' rate=100.00%


  █ TOTAL RESULTS 

    checks_total.......: 10855   179.349417/s
    checks_succeeded...: 100.00% 10855 out of 10855
    checks_failed......: 0.00%   0 out of 10855

    ✓ grant search returned 200
    ✓ grant response contains matches
    ✓ hot query returned expected grants
    ✓ cache header is present
    ✓ replica header is present

    CUSTOM
    cache_header_valid.............: 100.00% 2171 out of 2171
    cache_hit_rate.................: 84.15%  1827 out of 2171
    served_by_header_present.......: 100.00% 2171 out of 2171

    HTTP
    http_req_duration..............: avg=76.52ms  min=798µs    p(50)=5.03ms   p(95)=456.54ms p(99)=458.18ms max=464.75ms
      { endpoint:grants }..........: avg=76.52ms  min=798µs    p(50)=5.03ms   p(95)=456.54ms p(99)=458.18ms max=464.75ms
      { expected_response:true }...: avg=76.52ms  min=798µs    p(50)=5.03ms   p(95)=456.54ms p(99)=458.18ms max=464.75ms
    http_req_failed................: 0.00%   0 out of 2171
      { endpoint:grants }..........: 0.00%   0 out of 2171
    http_reqs......................: 2171    35.869883/s

    EXECUTION
    iteration_duration.............: avg=277.68ms min=201.26ms p(50)=206.05ms p(95)=657.67ms p(99)=659.82ms max=695.21ms
    iterations.....................: 2171    35.869883/s
    vus............................: 10      min=10           max=10
    vus_max........................: 10      min=10           max=10

    NETWORK
    data_received..................: 1.8 MB  31 kB/s
    data_sent......................: 219 kB  3.6 kB/s


# SLO Target Comparison

For the Services among the proposed ones 

grant-search-service:
Latency: GET /grants must return the grants matching the query within 500 milliseconds at the 95th percentile, so nonprofit staff can evaluate funding opportunities without disruptive waiting.
Reliability: At least 99.5% of valid search requests must succeed over a rolling 30-day period. Search requests use an idempotent read operation, so at-least-once delivery and client retries cannot create duplicate grants or modify stored data.

eligibility-analysis-service:
Latency: POST /eligibility-checks must return a result withing 2 seconds at the 95th percentile, so nonprofit staff can evaluate opportunities without interrupting their busy workflow.
Reliability: At least 99% of valid eligibility check requests must succeed over a rolling 30-day period. Requests may use at-least-once delivery, but an idempotency key must stop retires from overburdening the system with repeat analyses.

# Sprint 3 Load Test Result Comparison
k6 load test with written summary
Service: Grant Search Service
Test Paramaters: 45 Seconds, 10 VU

Significant Test Results:
Latency Values: http_req_duration:
- avg=121.93ms
- min=800µs
- p(50)=6.14ms
- p(95)=458.71ms
- p(99)=463.13ms
- max=668.5ms
cache_hit_rate: 74.60%
Request Rate: http_reqs: 1398 requests at 30.793197/s
Error Rate: http_req_failed: 0.00%
According to our docs/SLO.md our targets for the grant-search service were as followed, latency for p(95) at 500 milliseconds or less and for reliability 99.5% of request must succeed, For both of these metrics we did pass both of them p(95) = 458.71 and a 0.00% error rate. The other most significant statist to make note of is the cache hit rate of 74.60%. For our previous targets this rate allowed us to have p(95) be under 500ms when taking into consideration the simulated cache miss delay of 450ms. At the same time it is clear that cache hit rate is our main bottle neck as if the simulated delay were to be higher we may not have reached are targets. Because of this it is clear that making changes to keep that miss delay at the same amount or lower as well as improving our cache hit rates are the necessary changes to improve the service.

Eligibility Analysis Service SLO Comparison
The Eligibility Analysis Service met both of its documented SLOs during the 45-second k6 load test. The eligibility scenario ran with 2 concurrent virtual users and completed 109 eligibility requests without a single failure, producing a 0% error rate and a 100% success rate. This exceeded the service’s reliability target of at least 99% successful requests. The measured eligibility latency was 620.74 ms at p50, 881.03 ms at p95, and 901.33 ms at p99, with a maximum observed latency of 913.22 ms. Because the documented latency SLO requires p95 to remain below 2,000 ms, the measured p95 passed with approximately 1.12 seconds of margin. Every response also returned HTTP 200, contained all five eligibility checks and a numeric matchScore, and preserved the x-simulated-latency-ms header through Grant Search and the Eligibility Ambassador. These results show that the Eligibility Analysis Service remained reliable under concurrent load and that the Ambassador correctly preserved the service response and observable latency information. The primary source of eligibility latency remains the intentionally simulated analysis delay, but the current results remain comfortably within the service’s target.

# Bottleneck Interpretation
