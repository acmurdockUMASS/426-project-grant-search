## k6 load test with written summary  
#### Service: Grant Search Service  
Test Paramaters: 45 Seconds, 10 VU  

#### Significant Test Results:  
##### Latency Values: http_req_duration:  
###### - avg=121.93ms  
###### - min=800µs   
###### - p(50)=6.14ms   
###### - p(95)=458.71ms   
###### - p(99)=463.13ms   
###### - max=668.5ms   
##### cache_hit_rate: 74.60%   
##### Request Rate: http_reqs: 1398 requests at 30.793197/s   
##### Error Rate: http_req_failed: 0.00%  

  According to our docs/SLO.md our targets for the grant-search service were as followed,
latency for p(95) at 500 milliseconds or less and for reliability 99.5% of request must succeed,
For both of these metrics we did pass both of them p(95) = 458.71 and a 0.00% error rate.
The other most significant statist to make note of is the cache hit rate of 74.60%.
For our previous targets this rate allowed us to have p(95) be under 500ms when taking into consideration the simulated cache miss delay of 450ms.
At the same time it is clear that cache hit rate is our main bottle neck as if the simulated delay were to be higher we may not have reached are targets.
Because of this it is clear that making changes to keep that miss delay at the same amount or lower as well as improving our cache hit rates are the necessary changes to improve the service.

### Eligibility Analysis Service SLO Comparison

The Eligibility Analysis Service met both of its documented SLOs during the 45-second k6 load test. The eligibility scenario ran with 2 concurrent virtual users and completed 109 eligibility requests without a single failure, producing a 0% error rate and a 100% success rate. This exceeded the service’s reliability target of at least 99% successful requests. The measured eligibility latency was 620.74 ms at p50, 881.03 ms at p95, and 901.33 ms at p99, with a maximum observed latency of 913.22 ms. Because the documented latency SLO requires p95 to remain below 2,000 ms, the measured p95 passed with approximately 1.12 seconds of margin. Every response also returned HTTP 200, contained all five eligibility checks and a numeric `matchScore`, and preserved the `x-simulated-latency-ms` header through Grant Search and the Eligibility Ambassador. These results show that the Eligibility Analysis Service remained reliable under concurrent load and that the Ambassador correctly preserved the service response and observable latency information. The primary source of eligibility latency remains the intentionally simulated analysis delay, but the current results remain comfortably within the service’s target.
