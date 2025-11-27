#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Validating setup..."

# Check for .env file
if [ ! -f "$ROOT_DIR/.env" ]; then
  echo "FAIL: .env file not found. Run ./setup.sh --hobby-mode or copy .env.example to .env"
  exit 1
fi
echo "OK: .env file found."

# Check for Docker
if ! command -v docker >/dev/null 2>&1; then
  echo "FAIL: Docker is not installed or not in PATH."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "FAIL: Docker daemon is not running."
  exit 1
fi
echo "OK: Docker is running."

# Check for essential env vars
if grep -q "VT_API_KEY=$" "$ROOT_DIR/.env"; then
  echo "FAIL: VT_API_KEY is empty in .env"
  exit 1
fi
echo "OK: VT_API_KEY is set."

if grep -q "REDIS_URL=$" "$ROOT_DIR/.env"; then
  echo "FAIL: REDIS_URL is empty in .env"
  exit 1
fi
echo "OK: REDIS_URL is set."

echo "Setup validation passed!"
exit 0