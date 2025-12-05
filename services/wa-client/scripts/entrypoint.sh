#!/bin/sh
# WhatsApp Client Entrypoint Script
# Routes to the appropriate entry point based on WA_LIBRARY environment variable
#
# NOTE: Baileys adapter (main.js) has ESM compatibility issues with Node.js require().
# Until fixed, both libraries use index.js which supports both via runtime detection.

set -e

WA_LIBRARY="${WA_LIBRARY:-baileys}"

echo "Starting wa-client with WA_LIBRARY=$WA_LIBRARY (using index.js)"
# The legacy index.js handles library selection at runtime and works with both
exec node dist/index.js
