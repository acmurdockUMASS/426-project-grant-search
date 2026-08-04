## k6 load test with written summary
Service: Grant Search Service
Test Paramaters: 45 Seconds, 10 VU

Significant Test Results:
Latency Values: http_req_duration:
  avg=121.93ms 
  min=800µs
  p(50)=6.14ms   
  p(95)=458.71ms 
  p(99)=463.13ms 
  max=668.5ms 
cache_hit_rate: 74.60%
Request Rate: http_reqs: 1398 requests at 30.793197/s
Error Rate: http_req_failed: 0.00%
  
A comparison against your docs/SLO.md targets: which SLOs are you meeting, and which are not?
A brief interpretation: what do these numbers tell you about the system? Where is the bottleneck, and what would you change?
