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
