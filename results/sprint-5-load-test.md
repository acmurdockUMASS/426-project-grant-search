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

For the Services among the ones proposed in docs/SLO.md the targets were as followed:  

grant-search-service:  
Latency: GET /grants must return the grants matching the query within 500 milliseconds at the 95th percentile, so nonprofit staff can evaluate funding opportunities without disruptive waiting.
Reliability: At least 99.5% of valid search requests must succeed over a rolling 30-day period. Search requests use an idempotent read operation, so at-least-once delivery and client retries cannot create duplicate grants or modify stored data.  

eligibility-analysis-service:  
Latency: POST /eligibility-checks must return a result withing 2 seconds at the 95th percentile, so nonprofit staff can evaluate opportunities without interrupting their busy workflow.
Reliability: At least 99% of valid eligibility check requests must succeed over a rolling 30-day period. Requests may use at-least-once delivery, but an idempotency key must stop retires from overburdening the system with repeat analyses.  

In the context of the tests similar to sprint 3 for the grant search service we reached our latency and reliability goal once again showing the the system has maintained the status quo 

# Sprint 3 Load Test Result Comparison
Compared to the sprint 3 load test results were approximately the same with a few differences. (Sprint 3 Will be the first Number in a Pair)  
We can see this in the cache hit rate 74.60% vs 84.15% which likely increased due to the longer duration.  
The 0.00% and 0.00% error rates.  
The close 30.793197/s and 35.869883/s request rates.
Then, likely the most important metrics the http_req_duration min 800µs vs 798µs, a larger difference of max 668.5ms vs 464.75ms,   
And very little difference between p(50) 6.14ms vs 5.03ms, p(95) 458.71ms vs 456.54ms, and lastly p(90) 463.13ms vs 458.18ms 
As show the largest difference was the max duration and the cache hit rate which were both improvements.

# Bottleneck Interpretation  
Because of the lack of changes in the test data I believe that the bottleneck of the system especially with regards to the search service remains the same. Restating it that  if the simulated delay were to be higher we may not have reached our SLO targets. Because of this it is remains that improving cache hit rates are one of the necessary changes to improve that particular service service.  
