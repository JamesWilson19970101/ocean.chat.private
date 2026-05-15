#!/bin/bash
echo "Waiting for the Kubernetes cluster to start..."

# 1. Loop to detect if K8s is ready (check every 5 seconds)
while ! kubectl get nodes > /dev/null 2>&1; do
  sleep 5
done

echo "K8s cluster is ready, checking infrastructure services status..."

# 2. Wait for specific Pods to be ready (prevents K8s from being up but MongoDB is still initializing)
kubectl wait --for=condition=Ready pod/mongodb-0 -n infrastructure --timeout=300s > /dev/null 2>&1

echo "Services are ready! Establishing port forwarding tunnels..."

# 3. Clean up any lingering port-forward processes
pkill -f port-forward

# 4. Establish tunnels and put them in the background
kubectl port-forward -n infrastructure svc/nats 4222:4222 > /dev/null 2>&1 &
kubectl port-forward -n infrastructure pod/mongodb-0 27017:27017 > /dev/null 2>&1 &
kubectl port-forward -n infrastructure svc/redis-master 6379:6379 > /dev/null 2>&1 &

echo "✅ Local development environment is fully connected!"
echo "NATS: 127.0.0.1:4222 | Redis: 127.0.0.1:6379 | MongoDB: 127.0.0.1:27017"
