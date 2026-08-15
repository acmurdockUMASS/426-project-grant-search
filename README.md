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



