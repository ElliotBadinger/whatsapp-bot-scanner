#!/bin/sh
# WhatsApp Client Entrypoint Script
# Starts the Baileys adapter entry point (dist/main.js).

set -e

if [ -z "${MVP_MODE:-}" ] && [ -z "${REDIS_URL:-}" ]; then
  export MVP_MODE=1
  export WA_REMOTE_AUTH_STORE="${WA_REMOTE_AUTH_STORE:-memory}"
  echo "MVP_MODE not set and REDIS_URL missing; defaulting to MVP single-process mode."
fi

NODE_BIN="node"
if [ -x "/usr/bin/node" ]; then
  NODE_BIN="/usr/bin/node"
fi

echo "Starting wa-client (Baileys, dist/main.js)"
exec "$NODE_BIN" dist/main.js
