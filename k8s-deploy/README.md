# Ocean Chat Kubernetes Deployment Guide

This document explains how to deploy the Ocean Chat project and its related dependencies in a Kubernetes cluster.

## Infrastructure Version Requirements

Ocean Chat is a microservices-based IM platform that relies on the following infrastructure services. To ensure stable operation, please make sure the service versions you use match the following requirements:

* **MongoDB**: v7.0.14
* **Redis**: v8.6.3
* **NATS**: v2.10.26

## `helm-values` Configuration Summary

The `helm-values` folder in this directory contains customized Helm Values configuration files for the aforementioned infrastructure components (MongoDB, Redis, NATS). These files preset crucial parameters required for Ocean Chat to run properly (e.g., MongoDB must have replica sets enabled to support change streams, Redis persistence strategies, and related NATS configurations).

By using these preset files alongside official Helm Charts, you can quickly spin up a compliant environment in your cluster with ease.

## Installation Methods

### Method 1: Deploy using Helm with Preset Configurations (Recommended)

You can use standard Helm commands combined with our provided values files to install the infrastructure:

1. **Add necessary Helm repositories**:
   ```bash
   helm repo add bitnami <https://charts.bitnami.com/bitnami>
   helm repo add nats <https://nats-io.github.io/k8s/helm/charts/>
   helm repo update
   ```

2. **Deploy infrastructure** (please ensure the path correctly points to the corresponding yaml files during execution):

    > ⚠️ **Note**: There is a known pitfall here. If you run into issues, please refer to [this GitHub issue](https://github.com/triggerdotdev/trigger.dev/issues/2518) for more details.

   ```bash
   # Install MongoDB (ensure replica set is enabled)
   helm install mongodb bitnami/mongodb -f helm-values/mongodb-values.yaml

   # Install Redis
   helm install redis bitnami/redis -f helm-values/redis-values.yaml

   # Install NATS
   helm install nats nats/nats -f helm-values/nats-values.yaml
   ```

### Method 2: Self-Installation and Configuration (Bring Your Own)

If your team already has existing infrastructure (such as managed MongoDB/Redis provided by cloud vendors, or a self-hosted NATS cluster), you are completely free to **install and maintain these services yourself**.

You only need to ensure that the versions of the components used meet the requirements listed above. Then, when deploying Ocean Chat microservices, properly inject the corresponding connection credentials and address configurations (such as the database connection string, Redis address, etc.) into the project as environment variables to successfully start and use the project.
