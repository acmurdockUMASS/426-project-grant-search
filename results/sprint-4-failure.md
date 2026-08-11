# Scripted Failure Scenario for Grant Search Service

#### Environmental Variable Triggered Fault 
By switching the variable FAULT from 0 to 1. This makes the requests to /grants fail with status 500 errors. Because this is environmental variable based one or both services can be turned on. In this case a real system would be more resilient with multiple layers for example not failing on /grants if the there was the correct data in the cache or making sure request don't go to the Faulty service.
