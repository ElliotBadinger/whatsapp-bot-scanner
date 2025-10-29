#!/usr/bin/env bash
# shellcheck disable=SC2039
set -euo pipefail
IFS=$'\n\t'

SCRIPT_NAME=$(basename "$0")
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$SCRIPT_DIR"
ENV_FILE="$ROOT_DIR/.env"

# Default flags
CLEAN_RUN=false
RESET_RUN=false
NONINTERACTIVE=false
DO_PULL=false
BRANCH_NAME=""
FROM_TARBALL=""

# Default RemoteAuth phone number used when WA_REMOTE_AUTH_PHONE_NUMBER is unset.
REMOTE_AUTH_PHONE_DEFAULT="+27681687002"

# Environment toggles
if [ "${SETUP_NONINTERACTIVE:-}" = "1" ] || [ "${CI:-}" = "true" ]; then
  NONINTERACTIVE=true
fi

# Tracking arrays for post-run summaries
MISSING_KEYS=()
DISABLED_FEATURES=()

# Colors
if [ -t 1 ]; then
  COLOR_BLUE='\033[1;34m'
  COLOR_GREEN='\033[1;32m'
  COLOR_YELLOW='\033[1;33m'
  COLOR_RED='\033[1;31m'
  COLOR_CYAN='\033[1;36m'
  COLOR_RESET='\033[0m'
else
  COLOR_BLUE=''
  COLOR_GREEN=''
  COLOR_YELLOW=''
  COLOR_RED=''
  COLOR_CYAN=''
  COLOR_RESET=''
fi

SPINNER_PID=""

usage() {
  cat <<'USAGE'
Usage: ./setup.sh [options]

Options:
  --clean           Stop existing stack (docker compose down) before setup.
  --reset           Stop stack and remove volumes (DESTRUCTIVE: wipes DB + WhatsApp session). Prompts unless --noninteractive.
  --noninteractive  Run without prompts. Leaves placeholders, disables optional integrations, prints summary of missing keys.
  --pull            Pull latest code (git pull) and container images (docker compose pull).
  --branch=<name>   Checkout the specified git branch before running.
  --from=<tarball>  Use a local project tarball (for air-gapped setups). Extracts into current directory if repo missing.
  -h, --help        Show this help.

Environment flags:
  SETUP_NONINTERACTIVE=1  Force non-interactive mode without passing the CLI flag.
  CI=true                 Implies --noninteractive (useful for pipelines).

Examples:
  chmod +x setup.sh
  ./setup.sh
  ./setup.sh --clean --pull
USAGE
}

log() {
  local level="$1"; shift
  local color="$1"; shift
  printf "%b[%s]%b %s\n" "$color" "$level" "$COLOR_RESET" "$*"
}

log_section() { printf "\n%b==> %s%b\n" "$COLOR_BLUE" "$*" "$COLOR_RESET"; }
log_info() { log "INFO" "$COLOR_CYAN" "$*"; }
log_warn() { log "WARN" "$COLOR_YELLOW" "$*"; }
log_error() { log "ERROR" "$COLOR_RED" "$*"; }
log_success() { log "DONE" "$COLOR_GREEN" "$*"; }

record_missing_key() {
  local message="$1"
  for existing in "${MISSING_KEYS[@]}"; do
    if [ "$existing" = "$message" ]; then
      return
    fi
  done
  MISSING_KEYS+=("$message")
}

record_disabled_feature() {
  local message="$1"
  for existing in "${DISABLED_FEATURES[@]}"; do
    if [ "$existing" = "$message" ]; then
      return
    fi
  done
  DISABLED_FEATURES+=("$message")
}

stop_spinner() {
  if [ -n "$SPINNER_PID" ] && kill -0 "$SPINNER_PID" 2>/dev/null; then
    kill "$SPINNER_PID" 2>/dev/null || true
    wait "$SPINNER_PID" 2>/dev/null || true
  fi
  SPINNER_PID=""
  printf "\r\033[K" || true
}

start_spinner() {
  local message="$1"
  local spinner_chars='|/-\'
  local i=0
  printf "%s" "$message"
  (
    while true; do
      printf "\r%s %c" "$message" "${spinner_chars:i++%${#spinner_chars}}"
      sleep 0.1
    done
  ) &
  SPINNER_PID=$!
}

run_with_spinner() {
  local message="$1"; shift
  local cmd=("$@")
  start_spinner "$message"
  set +e
  "${cmd[@]}"
  local exit_code=$?
  set -e
  stop_spinner
  if [ $exit_code -eq 0 ]; then
    log_success "$message"
  else
    log_error "$message failed (exit $exit_code)"
    return $exit_code
  fi
}

cleanup() {
  local exit_code=$?
  stop_spinner
  if [ $exit_code -ne 0 ]; then
    log_error "Setup halted. Review the logs above for remediation steps."
  fi
}
trap cleanup EXIT

confirm_destructive() {
  local prompt="$1"
  if [ "$NONINTERACTIVE" = "true" ]; then
    log_warn "$prompt (auto-decline in non-interactive mode)."
    return 1
  fi
  printf "%s [y/N]: " "$prompt"
  read -r reply
  case "$reply" in
    [Yy]*) return 0 ;;
    *) log_warn "Skipping destructive action."; return 1 ;;
  esac
}

parse_args() {
  for arg in "$@"; do
    case "$arg" in
      --clean) CLEAN_RUN=true ;;
      --reset) RESET_RUN=true ;;
      --noninteractive) NONINTERACTIVE=true ;;
      --pull) DO_PULL=true ;;
      --branch=*) BRANCH_NAME=${arg#*=} ;;
      --from=*) FROM_TARBALL=${arg#*=} ;;
      -h|--help) usage; exit 0 ;;
      *)
        log_error "Unknown option: $arg"
        usage
        exit 1
        ;;
    esac
  done
}

ensure_repo() {
  if [ -n "$FROM_TARBALL" ] && [ ! -e "$ROOT_DIR/.git" ]; then
    log_section "Extracting project from tarball"
    if [ ! -f "$FROM_TARBALL" ]; then
      log_error "Tarball $FROM_TARBALL not found."
      exit 1
    fi
    if [ "$(ls -A "$ROOT_DIR" 2>/dev/null | wc -l)" -gt 1 ]; then
      log_warn "Directory not empty; skipping extraction. Ensure tarball contents are present."
    else
      run_with_spinner "Extracting $FROM_TARBALL" tar -xf "$FROM_TARBALL" -C "$ROOT_DIR"
      log_info "Ensure setup.sh resides at repository root; re-run if necessary."
    fi
  fi
  if [ ! -f "$ROOT_DIR/docker-compose.yml" ]; then
    log_error "docker-compose.yml not found. Run script from repository root or provide --from <tarball>."
    exit 1
  fi
}

require_cmd() {
  local cmd="$1"
  local hint="$2"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log_error "Missing required command: $cmd"
    log_info "Install hint: $hint"
    exit 1
  fi
}

detect_docker_compose() {
  if docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE=('docker' 'compose')
  elif command -v docker-compose >/dev/null 2>&1; then
    log_warn "Detected legacy docker-compose binary. Upgrading to Docker Compose v2 is recommended."
    DOCKER_COMPOSE=('docker-compose')
  else
    log_error "Docker Compose v2 not found. Install via https://docs.docker.com/compose/install/."
    exit 1
  fi
}

preflight_checks() {
  log_section "Preflight Checks"
  require_cmd docker "https://docs.docker.com/engine/install/"
  detect_docker_compose
  require_cmd make "Use your package manager (e.g., sudo apt install make)."
  require_cmd curl "https://curl.se/download.html"
  require_cmd sed "Install via coreutils / sed package."
  require_cmd awk "Install via gawk (sudo apt install gawk)."
  require_cmd openssl "Install via OpenSSL package."
  if ! "${DOCKER_COMPOSE[@]}" version >/dev/null 2>&1; then
    log_error "Docker Compose not responding. Ensure Docker Desktop/daemon is running."
    exit 1
  fi
  if ! docker info >/dev/null 2>&1; then
    log_error "Docker daemon unavailable. Start Docker and retry."
    exit 1
  fi
  if [ -n "${HTTP_PROXY:-}" ] || [ -n "${HTTPS_PROXY:-}" ]; then
    log_info "Proxy settings detected (HTTP_PROXY/HTTPS_PROXY). Docker builds inherit these automatically if configured."
  fi
  log_success "Environment checks passed."
}

checkout_branch() {
  if [ -n "$BRANCH_NAME" ]; then
    log_section "Checking out branch $BRANCH_NAME"
    if [ ! -d "$ROOT_DIR/.git" ]; then
      log_error "--branch requires a git repository. Clone the project first."
      exit 1
    fi
    run_with_spinner "git fetch" git -C "$ROOT_DIR" fetch --all --prune
    run_with_spinner "git checkout $BRANCH_NAME" git -C "$ROOT_DIR" checkout "$BRANCH_NAME"
  fi
}

pull_updates() {
  if [ "$DO_PULL" = "true" ]; then
    if [ -d "$ROOT_DIR/.git" ]; then
      log_section "Pulling latest application code"
      run_with_spinner "git pull" git -C "$ROOT_DIR" pull --ff-only
    fi
    log_section "Pulling container images"
    run_with_spinner "docker compose pull" "${DOCKER_COMPOSE[@]}" pull
  fi
}

ensure_env_file() {
  if [ ! -f "$ENV_FILE" ]; then
    log_section "Bootstrapping environment file"
    if [ ! -f "$ROOT_DIR/.env.example" ]; then
      log_error ".env.example missing. Cannot bootstrap environment."
      exit 1
    fi
    cp "$ROOT_DIR/.env.example" "$ENV_FILE"
    log_success "Created .env from template."
  else
    log_section "Using existing .env"
    log_info "Idempotent run: existing values preserved. Regenerated secrets only when missing."
  fi
}

set_env_var() {
  local key="$1"
  local value="$2"
  local temp_file
  temp_file=$(mktemp)
  if grep -qE "^${key}=" "$ENV_FILE"; then
    awk -v k="$key" -v v="$value" -F= 'BEGIN{OFS="="} $1==k {print k"="v; next} {print}' "$ENV_FILE" > "$temp_file"
  else
    cat "$ENV_FILE" > "$temp_file"
    printf '%s=%s\n' "$key" "$value" >> "$temp_file"
  fi
  mv "$temp_file" "$ENV_FILE"
}

get_env_var() {
  local key="$1"
  if [ ! -f "$ENV_FILE" ]; then
    return 1
  fi
  grep -E "^${key}=" "$ENV_FILE" | head -n1 | cut -d= -f2-
}

redact_value() {
  local value="$1"
  local length=${#value}
  if [ "$length" -le 8 ]; then
    printf '****'
  else
    printf '****%s' "${value:length-4:4}"
  fi
}

generate_secret() {
  openssl rand -hex 32
}

generate_base64_secret() {
  openssl rand -base64 32 | tr -d '\n'
}

ensure_secret() {
  local key="$1"
  local description="$2"
  local current
  current=$(get_env_var "$key" || true)
  if [ -n "$current" ] && [ "$current" != "change-me" ]; then
    return
  fi
  local secret
  secret=$(generate_secret)
  set_env_var "$key" "$secret"
  log_info "Generated $description (stored in .env as $(redact_value "$secret"))."
}

disable_integration() {
  local flag_key="$1"
  local reason="$2"
  set_env_var "$flag_key" "false"
  log_warn "$reason"
  record_disabled_feature "$reason"
}

prompt_remote_auth_phone() {
  while true; do
    printf "Enter WhatsApp phone number for RemoteAuth (digits only, e.g., 12025550123). Type 'skip' to fall back to QR pairing: "
    read -r phone_input || phone_input=""
    phone_input=$(printf '%s' "$phone_input" | tr -d '[:space:]')
    if [ -z "$phone_input" ]; then
      log_warn "Phone number cannot be empty."
      continue
    fi
    if [ "$phone_input" = "skip" ]; then
      log_warn "Skipping phone-number pairing; QR pairing will be required."
      return 1
    fi
    if [[ "$phone_input" =~ ^[0-9]{8,15}$ ]]; then
      set_env_var "WA_REMOTE_AUTH_PHONE_NUMBER" "$phone_input"
      log_info "Configured RemoteAuth phone number ($(redact_value "$phone_input"))."
      return 0
    fi
    log_warn "Invalid phone number '$phone_input'. Provide 8-15 digits, no symbols."
  done
}

ensure_remote_auth_defaults() {
  local strategy
  strategy=$(get_env_var "WA_AUTH_STRATEGY" || true)
  if [ -z "$strategy" ] || [ "$strategy" = "local" ]; then
    set_env_var "WA_AUTH_STRATEGY" "remote"
    log_info "Defaulted WA_AUTH_STRATEGY to remote."
  fi
  local data_key
  data_key=$(get_env_var "WA_REMOTE_AUTH_DATA_KEY" || true)
  if [ -z "$data_key" ]; then
    local generated
    generated=$(generate_base64_secret)
    set_env_var "WA_REMOTE_AUTH_DATA_KEY" "$generated"
    log_info "Generated RemoteAuth data key (stored in .env as $(redact_value "$generated"))."
  fi
  local phone
  phone=$(get_env_var "WA_REMOTE_AUTH_PHONE_NUMBER" || true)
  if [ -z "$phone" ]; then
    local sanitized_default
    sanitized_default=$(printf '%s' "${REMOTE_AUTH_PHONE_DEFAULT:-}" | tr -cd '0-9')
    if [ -n "$sanitized_default" ] && [[ "$sanitized_default" =~ ^[0-9]{8,15}$ ]]; then
      set_env_var "WA_REMOTE_AUTH_PHONE_NUMBER" "$sanitized_default"
      phone="$sanitized_default"
      log_info "Defaulted RemoteAuth phone number to $(redact_value "$sanitized_default")."
    else
      if [ "$NONINTERACTIVE" = "true" ]; then
        log_warn "WA_REMOTE_AUTH_PHONE_NUMBER not set; setup cannot auto-request pairing codes. Provide a digits-only number to enable phone-number pairing."
      else
        if prompt_remote_auth_phone; then
          phone=$(get_env_var "WA_REMOTE_AUTH_PHONE_NUMBER" || true)
        else
          phone=""
        fi
        if [ -z "$phone" ]; then
          log_warn "RemoteAuth phone number remains unset; QR pairing will be required."
        fi
      fi
    fi
  fi
  if [ -n "$phone" ]; then
    log_info "RemoteAuth pairing will target phone $(redact_value "$phone")."
    configure_remote_auth_autopair "$phone"
  fi
}

configure_remote_auth_autopair() {
  local phone="$1"
  local auto_pair
  auto_pair=$(get_env_var "WA_REMOTE_AUTH_AUTO_PAIR" || true)
  if [ -n "$auto_pair" ]; then
    return
  fi
  if [ "$NONINTERACTIVE" = "true" ]; then
    set_env_var "WA_REMOTE_AUTH_AUTO_PAIR" "false"
    log_info "RemoteAuth auto pairing disabled by default in non-interactive mode."
    return
  fi
  log_section "RemoteAuth Phone Pairing"
  log_info "Auto pairing immediately requests a WhatsApp code for $(redact_value "$phone")."
  log_info "Before enabling, open WhatsApp on that device, ensure it is online, and navigate to Linked Devices."
  printf "Automatically request a phone pairing code on startup? (y/N): "
  read -r auto_reply || auto_reply=""
  case "$auto_reply" in
    [Yy]*)
      set_env_var "WA_REMOTE_AUTH_AUTO_PAIR" "true"
      log_info "Enabled auto pairing. Keep WhatsApp open; the code will display shortly after services start."
      ;;
    *)
      set_env_var "WA_REMOTE_AUTH_AUTO_PAIR" "false"
      log_warn "Auto pairing disabled; setup will show a QR code for initial linking."
      ;;
  esac
}

prompt_for_key() {
  local key="$1"
  local friendly_name="$2"
  local signup_url="$3"
  local key_url="$4"
  local disable_flag="$5"
  local importance="${6:-recommended}"
  local additional_note="${7-}"
  local current
  current=$(get_env_var "$key" || true)
  if [ -n "$current" ]; then
    return
  fi
  log_section "$friendly_name API Key"
  log_info "$friendly_name integration improves verdict accuracy."
  log_info "1. Sign up (if needed): $signup_url"
  log_info "2. Generate or copy the key: $key_url"
  if [ -n "$additional_note" ]; then
    printf '%s\n' "$additional_note" | while IFS= read -r line; do
      [ -n "$line" ] && log_info "$line"
    done
  fi

  local impact
  case "$importance" in
    critical) impact="required for core scanning" ;;
    optional) impact="optional enrichment" ;;
    *) impact="recommended signal" ;;
  esac

  if [ "$NONINTERACTIVE" = "true" ]; then
    if [ -n "$disable_flag" ]; then
      disable_integration "$disable_flag" "$friendly_name disabled (no API key in non-interactive mode)."
    fi
    record_missing_key "$friendly_name ($impact) missing; re-run without --noninteractive to enable."
    log_warn "$friendly_name key missing. Re-run setup.sh without --noninteractive to add it later."
    return
  fi

  printf "Paste %s API key (leave blank to skip for now): " "$friendly_name"
  read -r api_key
  api_key=$(printf '%s' "$api_key" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
  if [ -z "$api_key" ]; then
    if [ -n "$disable_flag" ]; then
      disable_integration "$disable_flag" "$friendly_name disabled until key is provided."
    fi
    record_missing_key "$friendly_name ($impact) missing; add it later for better coverage."
    log_warn "Skipped $friendly_name key."
  else
    set_env_var "$key" "$api_key"
    log_success "$friendly_name key stored securely (redacted: $(redact_value "$api_key"))."
  fi
}

validate_queue_names() {
  log_section "Validating queue names"
  local queues=("SCAN_REQUEST_QUEUE" "SCAN_VERDICT_QUEUE" "SCAN_URLSCAN_QUEUE")
  for q in "${queues[@]}"; do
    local value
    value=$(get_env_var "$q" || true)
    if [ -z "$value" ]; then
      log_error "$q cannot be empty."
      exit 1
    fi
    if printf '%s' "$value" | grep -q ':'; then
      log_error "$q contains ':' (${value}). Update .env to use hyphen-separated names."
      exit 1
    fi
  done
  log_success "Queue naming OK."
}

port_in_use() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
  elif command -v ss >/dev/null 2>&1; then
    ss -tulpn | grep -q ":$port "
  else
    (echo > /dev/tcp/127.0.0.1/"$port") >/dev/null 2>&1 && return 0
    return 1
  fi
}

check_ports() {
  log_section "Port availability"
  local ports=("8088:Reverse proxy" "8080:Control Plane" "3002:Grafana" "3000:WA client (internal)")
  local collision=false
  for entry in "${ports[@]}"; do
    local port=${entry%%:*}
    local name=${entry#*:}
    if port_in_use "$port"; then
      log_warn "Port $port appears in use ($name). Update .env to adjust ports before continuing."
      case "$port" in
        8088) log_info "Tip: set REVERSE_PROXY_PORT=9088 (inside .env) and rerun if this keeps happening." ;;
        8080) log_info "Tip: bump CONTROL_PLANE_PORT (and REVERSE_PROXY upstream) in .env if another service already uses 8080." ;;
        3002) log_info "Tip: change Grafana mapping by editing docker-compose.yml or stop the conflicting service." ;;
      esac
      collision=true
    fi
  done
  if [ "$collision" = "true" ]; then
    log_warn "Port conflicts detected. Press Enter to continue anyway or Ctrl+C to abort."
    if [ "$NONINTERACTIVE" = "false" ]; then
      read -r _
    fi
  else
    log_success "No blocking port collisions detected."
  fi
}

prepare_env() {
  ensure_env_file
  ensure_secret "CONTROL_PLANE_API_TOKEN" "Control Plane bearer token"
  if [ -z "$(get_env_var "URLSCAN_CALLBACK_URL" || true)" ]; then
    set_env_var "URLSCAN_CALLBACK_URL" "http://reverse-proxy:8088/urlscan/callback"
  fi
  prompt_for_key "VT_API_KEY" "VirusTotal" "https://www.virustotal.com/gui/join-us" "https://www.virustotal.com/gui/my-apikey" "" "recommended" $'Steps: (1) Log in, (2) open your avatar -> API key, (3) copy the 64-character token.'
  prompt_for_key "GSB_API_KEY" "Google Safe Browsing" "https://console.cloud.google.com/freetrial" "https://console.cloud.google.com/apis/credentials" "" "recommended" $'In Google Cloud Console: create or select a project, enable the "Safe Browsing API", then use "Create Credentials -> API key".'
  prompt_for_key "URLSCAN_API_KEY" "urlscan.io" "https://urlscan.io/signup/" "https://urlscan.io/user/api" "URLSCAN_ENABLED" "recommended" $'Quota tip: urlscan free tier allows ~50 scans/day. Update URLSCAN_CONCURRENCY if you upgrade.'
  prompt_for_key "WHOISXML_API_KEY" "WhoisXML (optional)" "https://user.whoisxmlapi.com/identity/register" "https://user.whoisxmlapi.com/api-key-management" "WHOISXML_ENABLED" "optional"
  prompt_for_key "PHISHTANK_APP_KEY" "PhishTank (optional)" "https://www.phishtank.com/register.php" "https://www.phishtank.com/api_info.php" "" "optional"
  local urlscan_enabled
  urlscan_enabled=$(get_env_var "URLSCAN_ENABLED" || true)
  local urlscan_api_key
  urlscan_api_key=$(get_env_var "URLSCAN_API_KEY" || true)
  if [ -n "$urlscan_enabled" ] && [ "$(printf '%s' "$urlscan_enabled" | tr '[:upper:]' '[:lower:]')" = "false" ]; then
    set_env_var "URLSCAN_CALLBACK_SECRET" ""
    log_info "urlscan.io disabled; callback secret cleared."
  elif [ -z "$urlscan_api_key" ]; then
    disable_integration "URLSCAN_ENABLED" "urlscan.io disabled until API key provided."
    set_env_var "URLSCAN_CALLBACK_SECRET" ""
    record_missing_key "urlscan.io deep scans unavailable without URLSCAN_API_KEY."
  else
    ensure_secret "URLSCAN_CALLBACK_SECRET" "urlscan callback verifier"
  fi
  ensure_remote_auth_defaults
  local vt_rpm
  vt_rpm=$(get_env_var "VT_REQUESTS_PER_MINUTE" || true)
  [ -z "$vt_rpm" ] && vt_rpm="4"
  log_info "VirusTotal throttling set to ${vt_rpm} req/min (tweak VT_REQUESTS_PER_MINUTE in .env if your quota allows)."
  validate_queue_names
  check_ports
  log_success "Environment ready."
}

verify_api_keys() {
  log_section "Validating API keys"

  local vt_key
  vt_key=$(get_env_var "VT_API_KEY" || true)
  if [ -n "$vt_key" ]; then
    local vt_tmp
    vt_tmp=$(mktemp)
    local vt_code
    vt_code=$(curl -sS -o "$vt_tmp" -w '%{http_code}' --max-time 15 \
      -H "x-apikey: $vt_key" "https://www.virustotal.com/api/v3/ip_addresses/8.8.8.8" 2>/dev/null || true)
    if [ -z "$vt_code" ]; then
      log_warn "VirusTotal validation skipped (network error)."
    elif [ "$vt_code" = "200" ]; then
      log_success "VirusTotal API key accepted (sample lookup succeeded)."
    elif [ "$vt_code" = "401" ] || [ "$vt_code" = "403" ]; then
      log_error "VirusTotal API key rejected by API (HTTP $vt_code). Update VT_API_KEY and rerun."
      rm -f "$vt_tmp"
      exit 1
    else
      log_warn "VirusTotal validation returned HTTP $vt_code (check quota or network)."
      if [ -s "$vt_tmp" ]; then
        local vt_snippet
        vt_snippet=$(head -c 120 "$vt_tmp" | tr '\n' ' ')
        log_info "VirusTotal response snippet: $vt_snippet"
      fi
    fi
    rm -f "$vt_tmp"
  else
    log_warn "VT_API_KEY not set. VirusTotal checks will be skipped." && record_missing_key "VirusTotal disabled without VT_API_KEY."
  fi

  local gsb_key
  gsb_key=$(get_env_var "GSB_API_KEY" || true)
  if [ -n "$gsb_key" ]; then
    local gsb_tmp
    gsb_tmp=$(mktemp)
    local gsb_code
    gsb_code=$(curl -sS -o "$gsb_tmp" -w '%{http_code}' --max-time 15 \
      -H 'Content-Type: application/json' -X POST \
      "https://safebrowsing.googleapis.com/v4/threatMatches:find?key=$gsb_key" \
      -d '{"client":{"clientId":"wbscanner-setup","clientVersion":"1.0"},"threatInfo":{"threatTypes":["MALWARE"],"platformTypes":["ANY_PLATFORM"],"threatEntryTypes":["URL"],"threatEntries":[{"url":"https://example.com"}]}}' 2>/dev/null || true)
    if [ -z "$gsb_code" ]; then
      log_warn "Google Safe Browsing validation skipped (network error)."
    elif [ "$gsb_code" = "200" ]; then
      log_success "Google Safe Browsing API key accepted (threatMatches call succeeded)."
    elif [ "$gsb_code" = "400" ] || [ "$gsb_code" = "401" ] || [ "$gsb_code" = "403" ]; then
      log_error "GSB API key rejected (HTTP $gsb_code). Verify billing and API enablement."
      if [ -s "$gsb_tmp" ]; then
        local gsb_snippet
        gsb_snippet=$(head -c 120 "$gsb_tmp" | tr '\n' ' ')
        log_info "GSB response snippet: $gsb_snippet"
      fi
      rm -f "$gsb_tmp"
      exit 1
    else
      log_warn "GSB validation returned HTTP $gsb_code; check network or quota.";
    fi
    rm -f "$gsb_tmp"
  else
    log_warn "GSB_API_KEY not set. GSB protection disabled." && record_missing_key "Google Safe Browsing disabled without GSB_API_KEY."
  fi

  local urlscan_enabled urlscan_key
  urlscan_enabled=$(get_env_var "URLSCAN_ENABLED" || true)
  urlscan_key=$(get_env_var "URLSCAN_API_KEY" || true)
  if [ "${urlscan_enabled,,}" = "true" ]; then
    if [ -n "$urlscan_key" ]; then
      local urlscan_tmp
      urlscan_tmp=$(mktemp)
      local urlscan_code
      urlscan_code=$(curl -sS -o "$urlscan_tmp" -w '%{http_code}' --max-time 15 \
        -H "API-Key: $urlscan_key" "https://urlscan.io/user/quotas" 2>/dev/null || true)
      if [ -z "$urlscan_code" ]; then
        log_warn "urlscan.io validation skipped (network error)."
      elif [ "$urlscan_code" = "200" ]; then
        log_success "urlscan.io API key accepted (quota endpoint reachable)."
      elif [ "$urlscan_code" = "401" ] || [ "$urlscan_code" = "403" ]; then
        disable_integration "URLSCAN_ENABLED" "urlscan.io disabled: API key rejected (HTTP $urlscan_code)."
        set_env_var "URLSCAN_CALLBACK_SECRET" ""
        record_missing_key "urlscan.io unavailable until a valid key is provided."
      else
        local urlscan_snippet
        urlscan_snippet=$(head -c 120 "$urlscan_tmp" | tr '\n' ' ')
        log_warn "urlscan.io validation returned HTTP $urlscan_code; response: $urlscan_snippet."
      fi
      rm -f "$urlscan_tmp"
    else
      disable_integration "URLSCAN_ENABLED" "urlscan.io disabled: URLSCAN_API_KEY missing."
      set_env_var "URLSCAN_CALLBACK_SECRET" ""
      record_missing_key "urlscan.io deep scans unavailable without URLSCAN_API_KEY."
    fi
  fi

  local whois_enabled whois_key
  whois_enabled=$(get_env_var "WHOISXML_ENABLED" || true)
  whois_key=$(get_env_var "WHOISXML_API_KEY" || true)
  if [ "${whois_enabled,,}" = "true" ] && [ -n "$whois_key" ]; then
    local whois_tmp
    whois_tmp=$(mktemp)
    local whois_code
    whois_code=$(curl -sS -o "$whois_tmp" -w '%{http_code}' --max-time 15 \
      "https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=$whois_key&domainName=example.com&outputFormat=JSON" 2>/dev/null || true)
    if [ -z "$whois_code" ]; then
      log_warn "WhoisXML validation skipped (network error)."
    elif [ "$whois_code" = "200" ]; then
      local whois_status="unknown"
      if command -v jq >/dev/null 2>&1; then
        if jq -e '.ErrorMessage? // .WhoisRecord.errorMessage? // .WhoisRecord.dataErrorMessage?' "$whois_tmp" >/dev/null 2>&1; then
          whois_status="error"
        elif jq -e '.WhoisRecord' "$whois_tmp" >/dev/null 2>&1; then
          whois_status="ok"
        fi
      else
        if grep -qi '"ErrorMessage"' "$whois_tmp"; then
          whois_status="error"
        elif grep -q '"WhoisRecord"' "$whois_tmp"; then
          whois_status="ok"
        fi
      fi
      if [ "$whois_status" = "ok" ]; then
        log_success "WhoisXML API key accepted."
      elif [ "$whois_status" = "error" ]; then
        local whois_snippet
        whois_snippet=$(head -c 200 "$whois_tmp" | tr '\n' ' ')
        log_warn "WhoisXML responded with an error object; check account/quota: $whois_snippet."
      else
        local whois_snippet
        whois_snippet=$(head -c 200 "$whois_tmp" | tr '\n' ' ')
        log_warn "WhoisXML returned an unexpected payload (treating as warning): $whois_snippet."
      fi
    elif [ "$whois_code" = "401" ] || [ "$whois_code" = "403" ]; then
      disable_integration "WHOISXML_ENABLED" "WhoisXML disabled: API key rejected (HTTP $whois_code)."
      record_missing_key "WhoisXML enrichment disabled until key is fixed."
    else
      log_warn "WhoisXML validation returned HTTP $whois_code; inspect account status."
    fi
    rm -f "$whois_tmp"
  fi

  local phish_key
  phish_key=$(get_env_var "PHISHTANK_APP_KEY" || true)
  if [ -n "$phish_key" ]; then
    log_info "Phishtank key present; manual testing recommended (API currently rate-limited)."
  else
    log_warn "Phishtank APP key missing (registration presently closed); continuing without it."
  fi

  log_success "API key validation complete."
}

run_config_validation() {
  if [ -f "$ROOT_DIR/scripts/validate-config.js" ]; then
    log_section "Validating configuration"
    if ! node -v >/dev/null 2>&1; then
      log_warn "Node.js not detected; skipping scripts/validate-config.js."
      return
    fi
    node "$ROOT_DIR/scripts/validate-config.js" || {
      log_error "Config validation failed. Fix issues before continuing."
      exit 1
    }
    log_success "Configuration validated."
  fi
}

clean_up_stack() {
  if [ "$RESET_RUN" = "true" ]; then
    log_section "Reset Requested"
    log_warn "RESET deletes Postgres data and the WhatsApp session volume."
    if confirm_destructive "Type y to confirm the destructive reset"; then
      log_section "Resetting stack"
      run_with_spinner "docker compose down -v --remove-orphans" "${DOCKER_COMPOSE[@]}" down -v --remove-orphans
    else
      RESET_RUN=false
    fi
  elif [ "$CLEAN_RUN" = "true" ]; then
    log_section "Stopping existing stack"
    run_with_spinner "docker compose down" "${DOCKER_COMPOSE[@]}" down || true
  fi
}

build_and_launch() {
  log_section "Building containers"
  run_with_spinner "make build" make -C "$ROOT_DIR" build

  log_section "Resetting Docker stack"
  run_with_spinner "Stopping existing stack" "${DOCKER_COMPOSE[@]}" down --remove-orphans || true
  run_with_spinner "Pruning stopped containers" "${DOCKER_COMPOSE[@]}" rm -f || true

  log_section "Preparing WhatsApp session storage"
  run_with_spinner "Aligning wa-client session volume" \
    "${DOCKER_COMPOSE[@]}" run --rm --no-deps --user root --entrypoint /bin/sh \
    wa-client -c "mkdir -p /app/services/wa-client/data/session && chown -R pptruser:pptruser /app/services/wa-client/data"
  log_section "Starting stack"
  set +e
  run_with_spinner "make up" make -C "$ROOT_DIR" up
  local up_status=$?
  set -e
  if [ $up_status -ne 0 ]; then
    log_warn "Initial make up failed (exit $up_status); retrying with docker compose up -d."
    run_with_spinner "docker compose up" "${DOCKER_COMPOSE[@]}" up -d
  fi
}

wait_for_service() {
  local name="$1"
  local url="$2"
  local header="$3"
  local max_retries=30
  local attempt=1
  while [ $attempt -le $max_retries ]; do
    if [ -n "$header" ]; then
      if curl -sf -H "$header" "$url" >/dev/null 2>&1; then
        log_success "$name healthy at $url"
        return
      fi
    else
      if curl -sf "$url" >/dev/null 2>&1; then
        log_success "$name healthy at $url"
        return
      fi
    fi
    sleep 5
    attempt=$((attempt + 1))
  done
  log_error "$name did not become healthy at $url. Inspect docker compose logs."
  exit 1
}

wait_for_container_health() {
  local service="$1"
  local display="$2"
  local max_retries=30
  local attempt=1
  while [ $attempt -le $max_retries ]; do
    local container_id
    container_id=$("${DOCKER_COMPOSE[@]}" ps -q "$service")
    if [ -z "$container_id" ]; then
      sleep 2
      attempt=$((attempt + 1))
      continue
    fi
    local health
    health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || echo "unknown")
    case "$health" in
      healthy|running)
        log_success "$display container ready (status: $health)."
        return
        ;;
      unhealthy)
        log_error "$display container reported unhealthy. See: docker compose logs $service"
        exit 1
        ;;
    esac
    sleep 5
    attempt=$((attempt + 1))
  done
  log_error "$display container did not reach healthy state. Investigate with docker compose ps $service."
  exit 1
}

wait_for_foundations() {
  log_section "Waiting for core services"
  wait_for_container_health "postgres" "Postgres"
  wait_for_container_health "redis" "Redis"
  wait_for_container_health "scan-orchestrator" "Scan orchestrator"
  wait_for_container_health "control-plane" "Control plane"
}

wait_for_reverse_proxy() {
  local reverse_port
  reverse_port=$(get_env_var "REVERSE_PROXY_PORT" || true)
  if [ -z "$reverse_port" ]; then
    reverse_port="8088"
  fi
  local token
  token=$(get_env_var "CONTROL_PLANE_API_TOKEN" || true)
  if [ -n "$token" ]; then
    wait_for_service "Reverse proxy" "http://127.0.0.1:${reverse_port}/healthz" "Authorization: Bearer $token"
    wait_for_service "Control plane" "http://127.0.0.1:${reverse_port}/healthz" "Authorization: Bearer $token"
  else
    log_warn "Missing CONTROL_PLANE_API_TOKEN during health check; skipping reverse proxy validation."
  fi
}

wait_for_whatsapp_ready() {
  if [ "$NONINTERACTIVE" = "true" ]; then
    log_warn "Skipping WhatsApp health confirmation (--noninteractive). Run docker compose logs wa-client to pair the session manually."
    return
  fi
  wait_for_container_health "wa-client" "WhatsApp client"
}

tail_wa_logs() {
  if [ "$NONINTERACTIVE" = "true" ]; then
    log_warn "Skipping interactive WhatsApp pairing instructions (--noninteractive)."
    return
  fi
  local strategy
  strategy=$(get_env_var "WA_AUTH_STRATEGY" || true)
  strategy=$(printf '%s' "${strategy:-remote}" | tr '[:upper:]' '[:lower:]')
  local phone
  phone=$(get_env_var "WA_REMOTE_AUTH_PHONE_NUMBER" || true)
  local autopair
  autopair=$(get_env_var "WA_REMOTE_AUTH_AUTO_PAIR" || true)
  if [ "$strategy" = "remote" ] && [ -n "$phone" ] && [ "$autopair" = "true" ]; then
    log_section "WhatsApp RemoteAuth Pairing"
    log_info "Watch for a phone-number pairing code targeting $(redact_value "$phone")."
    log_info "Open WhatsApp > Linked Devices > Link with phone number and enter the code shown in the logs."
    log_info "If automatic pairing fails, the client will fall back to displaying a QR code."
  else
    log_section "WhatsApp QR Pairing"
    log_info "A QR code will appear below. Open WhatsApp > Linked Devices > Link a Device and scan it."
  fi
  log_info "This log view will exit automatically once the client reports 'WhatsApp client ready'."
  {
    "${DOCKER_COMPOSE[@]}" logs --no-color --tail 5 wa-client || true
    "${DOCKER_COMPOSE[@]}" logs --no-color --follow wa-client |
      while IFS= read -r line; do
        printf '%s\n' "$line"
        if printf '%s' "$line" | grep -q "WhatsApp client ready"; then
          break
        fi
      done
  } || true
}

smoke_test() {
  log_section "Smoke Test"
  local token
  token=$(get_env_var "CONTROL_PLANE_API_TOKEN" || true)
  if [ -z "$token" ]; then
    log_warn "Control plane token missing; cannot run authenticated smoke test."
    return
  fi
  local reverse_port
  reverse_port=$(get_env_var "REVERSE_PROXY_PORT" || true)
  if [ -z "$reverse_port" ]; then
    reverse_port="8088"
  fi
  local response
  response=$(curl -sf -H "Authorization: Bearer $token" "http://localhost:${reverse_port}/status" || true)
  if [ -n "$response" ]; then
    log_success "Control-plane status endpoint reachable."
  else
    log_warn "Control-plane status check failed; verify docker compose logs."
  fi
  log_info "Next steps:"
  log_info "- Share this consent blurb with pilot groups:"
  cat <<'CONSENT'

Hello! This group has enabled automated link scanning for safety.

What we do:
- Detect links posted here and check them against security sources.
- Post a brief verdict (benign/suspicious/malicious).

What we store:
- The link (normalized) and minimal message context (chat ID, message ID, hashed sender ID).
- Retention: 30 days by default.

Opt-out:
- Ask an admin to mute the bot for this group or for a period.

By continuing to use this group, you consent to automated link scanning. Thank you for helping keep everyone safe.
CONSENT
  log_info "- Drop a harmless link (for example https://example.com) in the pilot group to confirm verdict logging."
  log_info "- Try admin commands in a group (prefix with !scanner):"
  log_info "    - !scanner status"
  log_info "    - !scanner mute"
  log_info "    - !scanner unmute"
  log_info "    - !scanner rescan <url>"
  log_info "- Tail logs with make logs if you want to watch cross-service output in real time."
}

print_observability() {
  log_section "Observability & Access"
  local reverse_port
  reverse_port=$(get_env_var "REVERSE_PROXY_PORT" || true)
  if [ -z "$reverse_port" ]; then
    reverse_port="8088"
  fi
  log_info "Reverse proxy: http://localhost:${reverse_port}"
  log_info "Control plane UI: http://localhost:${reverse_port}/"
  log_info "Grafana: http://localhost:3002 (admin / admin)"
  log_info "Prometheus: accessible inside docker network at prometheus:9090"
  local token
  token=$(get_env_var "CONTROL_PLANE_API_TOKEN" || true)
  if [ -n "$token" ]; then
    log_info "Control plane token (redacted): $(redact_value "$token")"
  fi
  log_warn "Expose services behind TLS + IP restrictions before sharing beyond localhost."
}

print_troubleshooting() {
  log_section "Troubleshooting"
  cat <<'TROUBLE'
- Missing API keys: re-run ./setup.sh without --noninteractive to add keys, or edit .env manually.
- Queue naming errors: ensure *SCAN_* queue names contain only letters, numbers, or hyphens.
- WhatsApp login stuck: run `docker compose logs wa-client` and unlink previous sessions from the device.
- Port in use: adjust REVERSE_PROXY_PORT or CONTROL_PLANE_PORT in .env and rerun ./setup.sh --clean.
- Unexpected crashes: `docker compose logs <service>` and check scripts/validate-config.js output.
- Reset everything: ./setup.sh --reset (destroys DB + WhatsApp session) then rerun without flags.
TROUBLE
}

print_postrun_gaps() {
  if [ ${#MISSING_KEYS[@]} -gt 0 ]; then
    log_section "Pending API Keys"
    for entry in "${MISSING_KEYS[@]}"; do
      log_warn "$entry"
    done
    log_info "Add keys by editing .env or re-running ./setup.sh without --noninteractive."
  fi
  if [ ${#DISABLED_FEATURES[@]} -gt 0 ]; then
    log_section "Disabled Integrations"
    for entry in "${DISABLED_FEATURES[@]}"; do
      log_warn "$entry"
    done
  fi
}

main() {
  parse_args "$@"
  if [ "$NONINTERACTIVE" = "true" ]; then
    log_warn "Running in --noninteractive mode. Third-party integrations stay limited until you edit .env with API keys."
  fi
  ensure_repo
  preflight_checks
  checkout_branch
  pull_updates
  clean_up_stack
  prepare_env
  run_config_validation
  verify_api_keys
  build_and_launch
  wait_for_foundations
  tail_wa_logs
  wait_for_whatsapp_ready
  wait_for_reverse_proxy
  smoke_test
  print_observability
  print_postrun_gaps
  print_troubleshooting
  log_success "Setup complete. Re-run ./setup.sh anytime; operations are idempotent."
}

main "$@"
