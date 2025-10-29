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
SKIP_INSTALL=0

if [ "${FORCE_INSTALL}" != "1" ] && command -v wbscanner-mcp >/dev/null 2>&1; then
  log "wbscanner-mcp already on PATH; skipping reinstall. Set WBSCANNER_MCP_FORCE_INSTALL=1 to reinstall."
  SKIP_INSTALL=1
fi

if [ "${SKIP_INSTALL}" -ne 1 ]; then
  log "Installing wbscanner-mcp package via pip (editable, user site)."
  INSTALL_ARGS=(
    --user
    --disable-pip-version-check
    --no-warn-script-location
    --no-build-isolation
    -e "${PACKAGE_DIR}"
  )

  if ! "${PYTHON_BIN}" -m pip install "${INSTALL_ARGS[@]}"; then
    if "${PYTHON_BIN}" -m pip help install 2>/dev/null | grep -q -- "--break-system-packages"; then
      log "Retrying pip install with --break-system-packages (PEP 668 managed environment)."
      if ! "${PYTHON_BIN}" -m pip install --break-system-packages "${INSTALL_ARGS[@]}"; then
        log "pip install failed even with --break-system-packages; wbscanner-mcp may be unavailable."
      fi
    else
      log "pip install failed and --break-system-packages is unavailable; wbscanner-mcp may be unavailable."
    fi
  fi
fi

if command -v wbscanner-mcp >/dev/null 2>&1; then
  log "wbscanner-mcp installation complete."
else
  log "pip install finished but wbscanner-mcp still missing; check your PATH."
fi

WRAPPER_DIR="${ROOT_DIR}/scripts/bin"
WRAPPER_PATH="${WRAPPER_DIR}/wbscanner-mcp"

mkdir -p "${WRAPPER_DIR}"

cat >"${WRAPPER_PATH}" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PYTHON_CMD="${PYTHON_BIN:-${PYTHON:-python3}}"

if ! command -v "${PYTHON_CMD}" >/dev/null 2>&1; then
  echo "[wbscanner-mcp] Unable to find python interpreter '${PYTHON_CMD}'." >&2
  exit 127
fi

export PYTHONPATH="${REPO_ROOT}/scripts/agent_orchestrator:${PYTHONPATH:-}"
exec "${PYTHON_CMD}" -m agent_orchestrator.mcp_server "$@"
EOF

chmod +x "${WRAPPER_PATH}"
log "Repo-local wrapper available at scripts/bin/wbscanner-mcp (use with './scripts/bin/wbscanner-mcp')."

WRAPPED_PATH="$(command -v wbscanner-mcp || true)"

if [ -n "${WRAPPED_PATH}" ]; then
  if head -n 1 "${WRAPPED_PATH}" | grep -qE '^#!.*python'; then
    if WBSCANNER_MCP_ENTRYPOINT="${WRAPPED_PATH}" "${PYTHON_BIN}" <<'PY'
import os
import sys

script_path = os.environ.get("WBSCANNER_MCP_ENTRYPOINT")
if not script_path:
    sys.exit(0)

try:
    with open(script_path, "r", encoding="utf-8") as handle:
        lines = handle.readlines()
    if not lines:
        sys.exit(0)
    lines[0] = "#!/usr/bin/env python3\n"
    with open(script_path, "w", encoding="utf-8") as handle:
        handle.writelines(lines)
except (OSError, IOError):
    sys.exit(1)
PY
    then
      log "Normalized wbscanner-mcp shebang to use /usr/bin/env python3."
    else
      log "Failed to normalize wbscanner-mcp shebang (permission denied?)."
    fi
  fi
fi
