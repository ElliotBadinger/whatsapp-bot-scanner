#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$SCRIPT_DIR"
SETUP_WIZARD="$ROOT_DIR/scripts/setup-wizard.mjs"

if [ ! -f "$SETUP_WIZARD" ]; then
  echo "setup-wizard.mjs not found. Ensure you are running from the repository root." >&2
  exit 1
fi

NODE_BIN="${NODE_BIN:-node}"

if ! command -v "$NODE_BIN" >/dev/null 2>&1; then
  echo "Node.js is required to run the setup wizard. Install Node.js 18+ and try again." >&2
  exit 1
fi

NODE_VERSION="$("$NODE_BIN" -v | sed 's/^v//')"
NODE_MAJOR="${NODE_VERSION%%.*}"
if [ "${NODE_MAJOR:-0}" -lt 18 ]; then
  echo "Detected Node.js v$NODE_VERSION. Please upgrade to Node.js 18 or newer." >&2
  exit 1
fi


# Check for hobby mode flag
if [ "${1:-}" == "--hobby-mode" ]; then
  echo "Activating Hobby Mode..."
  if [ ! -f "$ROOT_DIR/.env" ]; then
    echo "Creating .env from .env.hobby..."
    cp "$ROOT_DIR/.env.hobby" "$ROOT_DIR/.env"
  else
    echo ".env already exists. Skipping creation."
  fi

  # Prompt for VT_API_KEY if missing
  if grep -q "VT_API_KEY=$" "$ROOT_DIR/.env"; then
    echo "VirusTotal API Key is required."
    read -p "Enter your VirusTotal API Key: " VT_KEY
    if [ -n "$VT_KEY" ]; then
      # Use sed to replace the empty key with the provided one
      # We use a different delimiter (|) to avoid issues with special chars in the key if any
      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|VT_API_KEY=|VT_API_KEY=$VT_KEY|g" "$ROOT_DIR/.env"
      else
        sed -i "s|VT_API_KEY=|VT_API_KEY=$VT_KEY|g" "$ROOT_DIR/.env"
      fi
      echo "API Key saved."
    else
      echo "Warning: No API Key provided. The scanner may not function correctly."
    fi
  fi

  echo "Hobby Mode setup complete. You can now run 'make up-minimal' to start the scanner."
  exit 0
fi
# Run the CLI-based setup wizard
exec "$NODE_BIN" "$SETUP_WIZARD" "$@"
