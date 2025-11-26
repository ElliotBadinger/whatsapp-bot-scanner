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


# Check if we are in a TTY or if the user explicitly requested CLI mode
if [ "${1:-}" == "--cli" ]; then
  exec "$NODE_BIN" "$SETUP_WIZARD" "$@"
fi

echo "Starting Setup Web App..."

# Install backend dependencies
echo "Installing backend dependencies..."
cd "$ROOT_DIR/services/setup-webapp/backend"
"$NODE_BIN" -v >/dev/null 2>&1 || { echo "Node.js not found"; exit 1; }
npm install --silent

# Install frontend dependencies and build (optional, for dev we can just run dev server)
# For a robust setup, we should probably build the frontend and serve it via the backend.
# But for this task, running the dev server is fine or we can serve static files.
# Let's run the backend which will spawn the setup script, and we need to serve the frontend.
# To keep it simple, let's run them concurrently or just tell the user to open the browser if we use dev server.

echo "Installing frontend dependencies..."
cd "$ROOT_DIR/services/setup-webapp/frontend"
npm install --silent

echo "Starting Web Interface..."
# We need to run both backend and frontend.
# Let's use a simple approach: start backend in background, start frontend in background (or dev server), and wait.

cd "$ROOT_DIR/services/setup-webapp/backend"
npm start > "$ROOT_DIR/logs/webapp-backend.log" 2>&1 &
BACKEND_PID=$!

cd "$ROOT_DIR/services/setup-webapp/frontend"
npm run dev > "$ROOT_DIR/logs/webapp-frontend.log" 2>&1 &
FRONTEND_PID=$!

echo "Web App running at http://localhost:5173"
echo "Backend running at http://localhost:3005"
echo "Logs are being written to $ROOT_DIR/logs/"

# Open browser (Linux)
if command -v xdg-open > /dev/null; then
  sleep 2
  xdg-open http://localhost:5173
fi

echo "Press Ctrl+C to stop the web app."
wait $BACKEND_PID $FRONTEND_PID
