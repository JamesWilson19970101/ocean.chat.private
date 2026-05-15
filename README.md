<p align="center">
  <img  src="https://github.com/JamesWilson19970101/ocean.chat.Artwork/blob/main/logos/logo.svg" data-canonical-src="https://github.com/JamesWilson19970101/ocean.chat.Artwork/blob/main/logos/logo.svg" width="400" />
</p>

<h1 align="center">
  Ocean Chat -- An IM platform you can fully trust.
</h1>

[doc](https://jameswilson19970101.github.io/ocean.chat.docs/docs/devdocs/monkey-protocol-spec) | [文档](https://jameswilson19970101.github.io/ocean.chat.docs/zh-CN/docs/devdocs/microservice)

## Description

Ocean Chat is a microservices-based IM platform.

## Prerequisites

Please ensure your local environment has the following infrastructure installed:
* **Node.js**: v22 or higher
* **Yarn**: v4.7.0 (enable via `corepack enable` and `yarn set version 4.7.0`)
* **MongoDB**: v7.0.14
* **Redis**: v8.6.3
* **NATS**: v2.10.26
* **Docker & Docker Compose**: For running infrastructure services (MongoDB, NATS, Redis, etc.)

Alternatively, if your computer runs fast enough, you can also directly install **Jaeger all-in-one 1.74.0**, **Prometheus v3.7.1**, **Grafana 12.3.0**, and **opentelemetry-collector-contrib**.

## Installation & Setup

**1. Install Dependencies**
```bash
yarn install
```

**2. Start Infrastructure (Docker)**

Run the following command to start NATS, Redis, MongoDB, and monitoring tools in the background:
```bash
docker compose up -d
```

**3. Initialize MongoDB Replica Set (⚠️ Important)**

Since the configuration uses a replica set for change streams, you must initialize it on the first run:

```bash
docker exec -it mongodb mongosh --eval "rs.initiate()"
```
