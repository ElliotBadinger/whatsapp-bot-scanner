#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_DIR="${ROOT_DIR}/scripts/agent_orchestrator"
PYTHON_BIN="${PYTHON_BIN:-${PYTHON:-python3}}"

log() {
  printf '[wbscanner-mcp] %s\n' "$1"
}

if ! command -v "${PYTHON_BIN}" >/dev/null 2>&1; then
  log "Python interpreter not found (looked for '${PYTHON_BIN}'); skipping MCP install."
  exit 0
fi

if ! [ -f "${PACKAGE_DIR}/pyproject.toml" ]; then
  log "Package directory missing (${PACKAGE_DIR}); skipping MCP install."
  exit 0
fi

FORCE_INSTALL="${WBSCANNER_MCP_FORCE_INSTALL:-0}"

if [ "${FORCE_INSTALL}" != "1" ] && command -v wbscanner-mcp >/dev/null 2>&1; then
  log "wbscanner-mcp already on PATH; skipping reinstall. Set WBSCANNER_MCP_FORCE_INSTALL=1 to reinstall."
  exit 0
fi

log "Installing wbscanner-mcp package via pip (editable, user site)."
INSTALL_ARGS=(
  --user
  --disable-pip-version-check
  --no-warn-script-location
  -e "${PACKAGE_DIR}"
)

if ! "${PYTHON_BIN}" -m pip install "${INSTALL_ARGS[@]}"; then
  if "${PYTHON_BIN}" -m pip help install 2>/dev/null | grep -q -- "--break-system-packages"; then
    log "Retrying pip install with --break-system-packages (PEP 668 managed environment)."
    if ! "${PYTHON_BIN}" -m pip install --break-system-packages "${INSTALL_ARGS[@]}"; then
      log "pip install failed even with --break-system-packages; wbscanner-mcp may be unavailable."
      exit 0
    fi
  else
    log "pip install failed and --break-system-packages is unavailable; wbscanner-mcp may be unavailable."
    exit 0
  fi
fi

if command -v wbscanner-mcp >/dev/null 2>&1; then
  log "wbscanner-mcp installation complete."
else
  log "pip install finished but wbscanner-mcp still missing; check your PATH."
fi
