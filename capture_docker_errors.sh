#!/bin/bash
set -e

LOG_FILE="docker_capture.log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "Starting Docker Error Capture at $(date)"

echo "--- Tearing down existing containers ---"
docker compose down -v --remove-orphans
sleep 5 || true

echo "--- Building images (no cache) ---"
docker compose build --no-cache

echo "--- Starting services ---"
docker compose up -d

echo "--- Waiting for services to stabilize (30s) ---"
sleep 30

echo "--- Capturing logs ---"
docker compose logs

echo "--- Checking container status ---"
docker ps -a

echo "--- Done at $(date) ---"
