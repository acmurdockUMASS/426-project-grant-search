# Scripted Failure Scenario for Grant Search Service

## Environment Variable Triggered Fault 
By switching the variable FAULT from 0 to 1. This makes the endpoints return errors. In this case a real system would be more resilient with multiple layers  not failing on /grants if the there was the correct data in the cache.
