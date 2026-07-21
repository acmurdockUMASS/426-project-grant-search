Overall because of the larger time scale that grants are worked around we can prioritise latency less and due to the importance of the grants reliability must be high.
For the same reason we should be aiming for at-least-once with some exceptions. <br>
grant-search-service: <br>
    Latency: The search must return top results within 0.5 seconds at the 95th percentile. <br>
    Reliability: The Search must be sucessful at the 95th percentile, to ensure the results are return at-least-once should be considered. <br>
user-profile-service: <br>
    Latency: Changes to the profile must occur within 0.5 seconds at the 95th percentile. <br>
    Reliability: Changes to the profile must be sucessful at the 99th percentile and should definilty be at-least-once. <br>
grant-tracking-service: <br>
    Latency: The Notification must go out with 60 seconds at the 95th percentile. <br>
    Reliability: The Notification must be sucessful at the 99th percentile and must occur only once. <br>
