Overall because of the larger time scale that grants are worked around we can priorities latency less and due to the importance of the grants reliability must be high.
For the same reason we should be aiming for at-least-once with some exceptions. <br>
---
## grant-search-service: <br>
  *  Latency: The search must return top results within 0.5 seconds at the 95th percentile to prevent the user from waiting too long. <br>
  *  Reliability: The Search must be successful at the 95th percentile, to ensure the results are return at-least-once should be considered. <br>
## user-profile-service: <br>
  *  Latency: Changes to the profile must occur within 0.5 seconds at the 95th percentile. <br>
  *  Reliability: Changes to the profile must be successful at the 99th percentile and should definitely be at-least-once. <br>
## grant-tracking-service: <br>
  *  Latency: The Notification must go out with 60 seconds at the 95th percentile as the notification need not be immediate. <br>
  *  Reliability: The Notification must be successful at the 99th percentile and must occur only once as duplicate notifications must be avoided. <br>
## eligibility-analysis-service:
 * Latency: POST /eligibility-checks must return a result withing 2 seconds at the 95th percentile, so nonprofit staff can evaluate opportunities without interrupting their busy workflow. 


 * Reliability: At least 99% of valid eligibility check requests must succeed over a rolling 30-day period. Requests may use at-least-once delivery, but an idempotency key must stop retires from overburdening the system with repeat analyses.

 ## grant-scraper-service:

* Latency: POST /ingestion/events must acknowledge an incoming grant record within 750 milliseconds at the 95th percentile, preventing backlogs that leaves users with outdated opportunities.<br>

* Reliability: At least 99.5% of valid ingestion events must be stored successfully. At-least-once delivery is ok but records must be deduplicated using the source grant ID and version so retries don't duplicate entries. <br>

## application-workflow-service:

* Latency: PATCH /applications/{applicationId}/tasks/{taskId} must complete within 400ms at the 95th percentile, so collaborators get updates and do not work from stale application information.  <br>

* Reliability:  At least 99.9% of valid application updates must succeed. Retried updates must be idempotent so at-least-once delivery cannot create duplicate tasks or repeat a status transition. <br>