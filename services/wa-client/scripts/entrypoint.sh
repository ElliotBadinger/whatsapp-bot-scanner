#!/bin/sh
# WhatsApp Client Entrypoint Script
# Routes to the appropriate entry point based on WA_LIBRARY environment variable
#
# - baileys: Uses main.js (ESM adapter-based entry point)
# - wwebjs: Uses index.js (legacy whatsapp-web.js entry point)

set -e

WA_LIBRARY="${WA_LIBRARY:-baileys}"

NODE_BIN="node"
if [ -x "/usr/bin/node" ]; then
  NODE_BIN="/usr/bin/node"
fi

case "$WA_LIBRARY" in
  baileys)
    echo "Starting wa-client with WA_LIBRARY=baileys (using main.js)"
    exec "$NODE_BIN" dist/main.js
    ;;
  wwebjs|whatsapp-web.js)
    echo "Starting wa-client with WA_LIBRARY=wwebjs (using index.js)"
    exec "$NODE_BIN" dist/index.js
    ;;
  *)
    echo "Unknown WA_LIBRARY: $WA_LIBRARY. Using baileys (default)."
    exec "$NODE_BIN" dist/main.js
    ;;
esac
