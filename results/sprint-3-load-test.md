3. k6 load test with written summary

  http_req_duration..............: avg=121.93ms min=800µs
  p(50)=6.14ms   p(95)=458.71ms p(99)=463.13ms max=668.5ms 
p50
p95
p99 
latency values from the k6 output

  cache_hit_rate.................: 74.60%  1043 out of 1398
    
    The request rate (requests per second) and error rate
    A comparison against your docs/SLO.md targets: which SLOs are you meeting, and which are not?
    A brief interpretation: what do these numbers tell you about the system? Where is the bottleneck, and what would you change?


    ✓ grant search returned 200
    ✓ grant response contains matches
    ✓ Cache header is present
    ✓ replica header is present

    CUSTOM
    cache_header_valid.............: 100.00% 1398 out of 1398
    cache_hit_rate.................: 74.60%  1043 out of 1398
    served_by_header_present.......: 100.00% 1398 out of 1398

    HTTP
    http_req_duration..............: avg=121.93ms min=800µs    p(50)=6.14ms   p(95)=458.71ms p(99)=463.13ms max=668.5ms 
      { endpoint:grants }..........: avg=121.93ms min=800µs    p(50)=6.14ms   p(95)=458.71ms p(99)=463.13ms max=668.5ms 
      { expected_response:true }...: avg=121.93ms min=800µs    p(50)=6.14ms   p(95)=458.71ms p(99)=463.13ms max=668.5ms 
    http_req_failed................: 0.00%   0 out of 1398
      { endpoint:grants }..........: 0.00%   0 out of 1398
    http_reqs......................: 1398    30.793197/s

    EXECUTION
    iteration_duration.............: avg=323.12ms min=201.16ms p(50)=207.14ms p(95)=659.6ms  p(99)=664.26ms max=899.35ms
    iterations.....................: 1398    30.793197/s
    vus............................: 10      min=10           max=10
    vus_max........................: 10      min=10           max=10

