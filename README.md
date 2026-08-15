# 426-project-grant-search
Project for UMass 426 Scalable Web Systems


## Team Name: Grant Search

## Team Members:
  Alex Murdock - Github: acmurdockUMASS  Gmail: acmurdock@umass.edu<br>
  Daniel Kennedy - Github: DMKennedy-UMass  Gmail: dmkennedy@umass.edu

## Domain:

  The system is meant to assist nonprofit companies, and grant dependent services easier accessibility and matching to federal loans that match their mission. The system simulates the challenge of serving multiple users at once, processing eligibility matching requests, delivering personalized grant recommendations, and notifying organizations when funding opportunities change or deadlines approach. A single server can become a bottleneck as thousands of organizations search, filter, and request eligibility analyses during periods of high demand. This makes caching async processing, load balancing, and resilient service design essential. Non-Profits, by definition have to serve a public or social mission. By assisting non-profits to generate funding our project aims to help those who help others. Many small non-profit companies struggle to wade through grants, and determine if it is applicable to their cause, or when they don't have money to pay for grant finding tools. 
  Ensuring nonprofit companies do not have a lack of funds is particularly important as it could either disrupt their services or in the worse case lead to the legal dissolution of the nonprofit. In this way the system can help ensure these non profits are able to continue to provide their services to their communities.

## Links:
* [PROJECT Description](docs/PROJECT.md)
* [SERVICES Documentation](docs/SERVICES.md)
* [SLO Documentaiton](docs/SLO.md)

## Architecture

```text
Client
  -> Caddy load balancer
     -> Grant Search replica 1
     -> Grant Search replica 2
        <-> Shared Redis cache
        -> Eligibility Ambassador
           -> Eligibility Service
        -> RabbitMQ
           -> Grant Alert Worker

Grant Search replicas ----\
Eligibility Ambassador ----\
Eligibility Service --------> Prometheus -> Grafana
Grant Alert Worker ---------/
```

The major layers are:

- **Caddy:** Public entry point and load balancer.
- **Grant Search:** Two replicated instances serving grant searches, eligibility forwarding, and grant-alert submissions.
- **Redis:** Shared cache used by both Grant Search replicas.
- **Eligibility Ambassador:** Proxy that isolates Grant Search from the Eligibility Service and enforces an upstream timeout.
- **Eligibility Service:** Performs simulated eligibility checks.
- **RabbitMQ:** Durable message broker for asynchronous grant-alert jobs.
- **Grant Alert Worker:** Consumes and processes jobs from RabbitMQ.
- **Prometheus:** Scrapes metrics from every custom service.
- **Grafana:** Automatically loads the system dashboard from the committed provisioning files.

More architecture information is available in [`docs/SERVICES.md`](docs/SERVICES.md).

## Prerequisites

To run the complete system, install:

- [Git](https://git-scm.com/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) or another Docker installation with Docker Compose
- [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) to run the final load test

Node.js does not need to be installed on the host because the custom services run inside Docker containers.

Before starting, confirm that Docker is running:

```bash
docker version
docker compose version
```

## Clean-clone setup

Clone the public repository and enter its directory:

```bash
git clone https://github.com/acmurdockUMASS/426-project-grant-search.git
cd 426-project-grant-search
```

Start the complete system with one command:

```bash
docker compose up
```

On the first run, Docker builds the custom service images and downloads the Redis, RabbitMQ, Caddy, Prometheus, and Grafana images. Startup may take a few minutes.

To run the system in the background instead:

```bash
docker compose up -d
```

If source files or dependencies changed and the images need to be rebuilt:

```bash
docker compose up -d --build
```

Check container state with:

```bash
docker compose ps
```

The custom services should become healthy after their dependencies finish starting.


## Service URLs 

| Component | URL | Purpose |
|---|---|---|
| Grant Search through Caddy | <http://localhost:3000> | Main public API |
| Eligibility Service | <http://localhost:3001> | Direct eligibility-service access |
| Eligibility Ambassador | <http://localhost:3002> | Direct Ambassador access |
| Grant Alert Worker | <http://localhost:3003> | Worker health and metrics |
| Grafana | <http://localhost:3004> | Automatically provisioned dashboard |
| Prometheus | <http://localhost:9090> | Metrics queries and scrape-target status |
| Prometheus targets | <http://localhost:9090/targets> | Status of all scrape targets |
## Verify the running system

### Grant Search health

```bash
curl http://localhost:3000/health
```

Expected result:

```json
{
  "status": "ok",
  "service": "grant-search-service",
  "instanceId": "grant-search-1",
  "rabbitmq": "connected",
  "faultSwitch": "0"
}
```

The request may reach either Grant Search replica.

### Search for grants

Return all grants:

```bash
curl http://localhost:3000/grants
```

Search for ongoing grants:

```bash
curl "http://localhost:3000/grants?grantStatus=Ongoing"
```

Search by region:

```bash
curl "http://localhost:3000/grants?orgQueryRegion=Massachusetts"
```

Search by interest:

```bash
curl "http://localhost:3000/grants?orgQueryInterests=environment"
```

Grant-search responses include:

- `X-Cache: HIT` or `X-Cache: MISS`
- `X-Served-By`, identifying the replica selected by Caddy

### Submit an eligibility check

Eligibility requests can be sent through the main Grant Search endpoint:

```bash
curl -X POST http://localhost:3000/eligibility-checks \
  -H "Content-Type: application/json" \
  -d '{
    "organization": {
      "id": "org-100",
      "name": "Community Education Network",
      "entityType": "501(c)(3)",
      "state": "Massachusetts",
      "annualBudget": 250000,
      "yearsOperating": 5,
      "missionAreas": ["education", "community"]
    },
    "grant": {
      "id": "grant-200",
      "title": "Massachusetts Education Grant",
      "eligibleEntityTypes": ["501(c)(3)"],
      "eligibleStates": ["Massachusetts"],
      "minimumAnnualBudget": 100000,
      "maximumAnnualBudget": 500000,
      "minimumYearsOperating": 2,
      "focusAreas": ["education"]
    }
  }'
```

A successful response contains:

- An eligibility-check ID
- The organization and grant IDs
- Five eligibility checks
- An eligibility result
- A numeric match score
- Simulated processing latency

### Queue a grant-alert job

```bash
curl -X POST http://localhost:3000/grant-alerts \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "org-100",
    "organizationName": "Community Education Network",
    "grantId": "13333",
    "grantName": "Massachusetts Education Grant Opportunities for Student Success",
    "alertType": "deadline-reminder"
  }'
```

A successful request returns HTTP `202` with a generated job ID. Grant Search publishes the job to the durable `grant-alert-jobs` RabbitMQ queue. The Grant Alert Worker logs `picked_up` and `processed` before acknowledging the message.

View the producer and worker logs with:

```bash
docker compose logs -f grant-search-1 grant-search-2 grant-alert-worker
```

## Metrics and Grafana

Every custom service exposes `GET /metrics` in Prometheus text format.

The required metrics are:

- `http_requests_total`
- `http_request_duration_milliseconds`

The request counter and response-time histogram include labels for:

- HTTP method
- Route
- Status code

Prometheus scrapes five targets:

- `grant-search-1:3000`
- `grant-search-2:3000`
- `eligibility-ambassador:3000`
- `eligibility-service:3000`
- `grant-alert-worker:3000`

Confirm that all five targets are `UP` at:

<http://localhost:9090/targets>

Grafana automatically loads the **Grant Search System Overview** dashboard at:

<http://localhost:3004>

The dashboard displays the required main-path measurements:

- Request rate
- Non-2xx error rate
- p95 response latency

Generate requests with the k6 load test while viewing Grafana to see the panels update.

## Structured JSON logging

Every custom service emits structured JSON logs.

All application log entries contain at least:

- `timestamp`
- `level`
- `message`
- `service`

HTTP request-completion logs also contain:

- `method`
- `path`
- `statusCode`
- `responseTimeMs`

View all custom-service logs with:

```bash
docker compose logs -f grant-search-1 grant-search-2 eligibility-ambassador eligibility-service grant-alert-worker
```

## Run the final load test

Make sure the complete Docker Compose system is running and healthy.

Run the final test from the repository root:

```bash
k6 run load-tests/sprint-5-load.js
```

The script defaults to:

```text
BASE_URL=http://localhost:3000
Virtual users: 10
Duration: 60 seconds
```

To use a different base URL in Bash:

```bash
BASE_URL=http://localhost:3000 k6 run load-tests/sprint-5-load.js
```

To set the URL in PowerShell:

```powershell
$env:BASE_URL = "http://localhost:3000"
k6 run .\load-tests\sprint-5-load.js
Remove-Item Env:BASE_URL
```

The test checks:

- HTTP 200 responses
- Correct grant results for known queries
- Valid `X-Cache` headers
- Presence of the `X-Served-By` header
- Less than 0.5% failed requests
- Grant Search p95 below 500 milliseconds
- More than 99% successful checks
- A realistic mix of cache hits and misses

The committed final result is in [`results/sprint-5-load-test.md`](results/sprint-5-load-test.md).

The committed run used 10 VUs for 60 seconds and recorded:

- 2,171 requests
- 35.87 requests per second
- 0% failed requests
- 100% successful checks
- 456.54 ms p95 latency
- 84.15% cache-hit rate

The documented Grant Search SLO requires p95 latency below 500 milliseconds and at least 99.5% successful valid requests. The committed run passed both targets.

See [`docs/SLO.md`](docs/SLO.md) for all service-level objectives.

## Environment variables

The checked-in `docker-compose.yml` supplies working development values, so no `.env` file is required for a normal startup.

Most variables below are container configuration values set directly in `docker-compose.yml`. The two `GRANT_SEARCH_*_FAULT` variables are host-side Compose overrides and can be supplied through the shell or a `.env` file.

### Grant Search

| Variable | Working development value | Behavior when missing |
|---|---|---|
| `PORT` | `3000` | Defaults to `3000`. |
| `INSTANCE_ID` | `grant-search-1` or `grant-search-2` | Defaults to `grant-search`; requests still work, but replica identity in health responses and logs is no longer distinct. |
| `REDIS_URL` | `redis://redis:6379` | The Redis client falls back toward a local/default connection. Inside the container that does not identify the Compose Redis service, so Grant Search may fail to connect or become unhealthy. |
| `ELIGIBILITY_AMBASSADOR_URL` | `http://eligibility-ambassador:3000` | Defaults to the same Compose URL. |
| `RABBITMQ_URL` | `amqp://grantsearch:grantsearch-dev@rabbitmq:5672` | Defaults to the same Compose URL. If RabbitMQ uses different credentials, alert jobs cannot be queued. |
| `GRANT_ALERT_QUEUE` | `grant-alert-jobs` | Defaults to `grant-alert-jobs`. |
| `FAULT` | `0` | Defaults to `0`, meaning the replica operates normally. `1` makes `/health` return 503 and makes main service requests fail so Caddy failover can be demonstrated. |
| `DATA_DIR` | `./data` | Defaults to `./data`. It is currently reserved for data-file configuration and is not used by the in-code simulated grant dataset. |
| `CACHE_TTL_SECONDS` | `60` in Compose | The current implementation does not read this variable and uses a hardcoded Redis expiration of 3,600 seconds. Removing it currently has no effect. |

### Host-side fault switches

| Variable | Working development value | Behavior when missing |
|---|---|---|
| `GRANT_SEARCH_1_FAULT` | `0` | Defaults to `0`; replica 1 operates normally. Compose passes the value to replica 1 as `FAULT`. |
| `GRANT_SEARCH_2_FAULT` | `0` | Defaults to `0`; replica 2 operates normally. Compose passes the value to replica 2 as `FAULT`. |

Example PowerShell fault configuration:

```powershell
$env:GRANT_SEARCH_1_FAULT = "1"
docker compose up -d --force-recreate grant-search-1 caddy
```

Restore normal operation:

```powershell
Remove-Item Env:GRANT_SEARCH_1_FAULT
docker compose up -d --force-recreate grant-search-1 caddy
```

### Eligibility Ambassador

| Variable | Working development value | Behavior when missing |
|---|---|---|
| `PORT` | `3000` | Defaults to `3000`. |
| `UPSTREAM_URL` | `http://eligibility-service:3000` | Defaults to the same Compose URL. |
| `UPSTREAM_TIMEOUT_MS` | `1500` | Defaults to 1,500 ms when missing, invalid, zero, or negative. |

### Eligibility Service

| Variable | Working development value | Behavior when missing |
|---|---|---|
| `PORT` | `3000` in Compose | The source defaults to `3001`. Inside Compose, omitting `PORT=3000` would make the service listen on the wrong internal port and fail its port-3000 health check. |
| `MIN_LATENCY_MS` | `350` | Defaults to 350 ms. |
| `MAX_LATENCY_MS` | `900` | Defaults to 900 ms. |
| `DATA_DIR` | `./data` | Defaults to `./data`. It is currently reserved and is not used by the simulated eligibility dataset. |

### Grant Alert Worker

| Variable | Working development value | Behavior when missing |
|---|---|---|
| `PORT` | `3000` | Defaults to `3000`. |
| `RABBITMQ_URL` | `amqp://grantsearch:grantsearch-dev@rabbitmq:5672` | Defaults to the same Compose URL. If the RabbitMQ credentials do not match, the worker remains unready and retries its connection. |
| `GRANT_ALERT_QUEUE` | `grant-alert-jobs` | Defaults to `grant-alert-jobs`. |
| `PROCESSING_DELAY_MS` | `250` | Defaults to a simulated 250 ms processing delay. |

### RabbitMQ

| Variable | Working development value | Behavior when missing |
|---|---|---|
| `RABBITMQ_DEFAULT_USER` | `grantsearch` | The RabbitMQ image falls back to its default user configuration. That would no longer match the URLs used by Grant Search and the worker. |
| `RABBITMQ_DEFAULT_PASS` | `grantsearch-dev` | The RabbitMQ image falls back to its default password configuration. The queue producer and worker would fail authentication unless their URLs were changed too. |

The checked-in RabbitMQ credentials are development-only values. They must not be reused for a public production deployment.

### Grafana

| Variable | Working development value | Behavior when missing |
|---|---|---|
| `GF_AUTH_ANONYMOUS_ENABLED` | `true` | Anonymous access is disabled by default, so users must authenticate. |
| `GF_AUTH_ANONYMOUS_ORG_ROLE` | `Viewer` | Anonymous users receive Grafana’s default anonymous role when anonymous access is enabled. |
| `GF_AUTH_DISABLE_LOGIN_FORM` | `true` | The Grafana login form is displayed if this setting is removed. |

### k6

| Variable | Working development value | Behavior when missing |
|---|---|---|
| `BASE_URL` | `http://localhost:3000` | The load-test script defaults to `http://localhost:3000`. |

## Stop the system

Stop and remove the containers while retaining named-volume data:

```bash
docker compose down
```

To also remove the project’s named volumes:

```bash
docker compose down -v
```

The `-v` command deletes the RabbitMQ and grant-data volumes and should only be used when a fully clean local reset is intended.

## Project documentation

- [Project description](docs/PROJECT.md)
- [Service architecture](docs/SERVICES.md)
- [Service-level objectives](docs/SLO.md)
- [Sprint 3 load-test results](results/sprint-3-load-test.md)
- [Sprint 4 failure results](results/sprint-4-failure.md)
- [Sprint 5 final load-test results](results/sprint-5-load-test.md)
- [AI disclosure](AI-DISCLOSURE.md)