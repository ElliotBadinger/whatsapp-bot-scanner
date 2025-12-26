#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage: $(basename "$0") --wa <url> --orchestrator <url> --control-plane <url> --postgres <connection> --redis <connection>

Options:
  --wa             Base URL for the wa-client service (no trailing /healthz)
  --orchestrator   Base URL for the scan-orchestrator service
  --control-plane  Base URL for the control-plane service
  --postgres       PostgreSQL connection string (e.g. postgres://user:pass@host:5432/db)
  --redis          Redis connection string (redis:// or rediss://)
  -h, --help       Show this help message

The script checks HTTP /healthz endpoints, runs a SELECT 1 against PostgreSQL, and issues a PING to Redis.
USAGE
}

wa_url=""
orchestrator_url=""
control_plane_url=""
postgres_url=""
redis_url=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --wa)
      wa_url="$2"
      shift 2
      ;;
    --orchestrator)
      orchestrator_url="$2"
      shift 2
      ;;
    --control-plane)
      control_plane_url="$2"
      shift 2
      ;;
    --postgres)
      postgres_url="$2"
      shift 2
      ;;
    --redis)
      redis_url="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

for var_name in wa_url orchestrator_url control_plane_url postgres_url redis_url; do
  if [[ -z "${!var_name}" ]]; then
    echo "Missing required flag for ${var_name/_url/}" >&2
    usage >&2
    exit 1
  fi
done

normalize_url() {
  local raw="$1"
  raw="${raw%%/}"
  echo "$raw"
}

check_http() {
  local name="$1"
  local base
  base=$(normalize_url "$2")
  local target="${base}/healthz"
  echo "Checking ${name} (${target})..."
  if curl --fail --silent --show-error "$target" | grep -q '"ok"[[:space:]]*:[[:space:]]*true'; then
    echo "  ✔ ${name} returned ok=true"
  else
    echo "  ✖ ${name} health check failed" >&2
    return 1
  fi
}

check_postgres() {
  local url="$1"
  if ! command -v psql >/dev/null 2>&1; then
    echo "  ✖ psql not installed; cannot validate PostgreSQL" >&2
    return 1
  fi
  echo "Checking PostgreSQL connectivity..."
  if psql "$url" -Atqc 'SELECT 1;' >/dev/null 2>&1; then
    echo "  ✔ PostgreSQL responded to SELECT 1"
  else
    echo "  ✖ PostgreSQL connection failed" >&2
    return 1
  fi
}

check_redis() {
  local url="$1"
  if ! command -v redis-cli >/dev/null 2>&1; then
    echo "  ✖ redis-cli not installed; cannot validate Redis" >&2
    return 1
  fi
  echo "Checking Redis connectivity..."
  if redis-cli -u "$url" PING >/dev/null 2>&1; then
    echo "  ✔ Redis replied to PING"
  else
    echo "  ✖ Redis connection failed" >&2
    return 1
  fi
}

overall_status=0

check_http "wa-client" "$wa_url" || overall_status=1
check_http "scan-orchestrator" "$orchestrator_url" || overall_status=1
check_http "control-plane" "$control_plane_url" || overall_status=1
check_postgres "$postgres_url" || overall_status=1
check_redis "$redis_url" || overall_status=1

if [[ $overall_status -eq 0 ]]; then
  echo "All checks passed."
else
  echo "One or more checks failed." >&2
fi

exit $overall_status
