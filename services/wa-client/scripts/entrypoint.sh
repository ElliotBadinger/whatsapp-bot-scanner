#!/bin/sh
# WhatsApp Client Entrypoint Script
# Routes to the appropriate entry point based on WA_LIBRARY environment variable
#
# - baileys: Uses main.js (ESM adapter-based entry point)
# - wwebjs: Uses index.js (legacy whatsapp-web.js entry point)

set -e

WA_LIBRARY="${WA_LIBRARY:-baileys}"

case "$WA_LIBRARY" in
  baileys)
    echo "Starting wa-client with WA_LIBRARY=baileys (using main.js)"
    exec node dist/main.js
    ;;
  wwebjs|whatsapp-web.js)
    echo "Starting wa-client with WA_LIBRARY=wwebjs (using index.js)"
    exec node dist/index.js
    ;;
  *)
    echo "Unknown WA_LIBRARY: $WA_LIBRARY. Using baileys (default)."
    exec node dist/main.js
    ;;
esac
