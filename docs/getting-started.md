# Getting Started with the Guided Setup Wizard

The `./setup.sh` entry point now launches an interactive Node.js wizard that walks operators through every step of bringing the WhatsApp Bot Scanner stack online.

## Prerequisites

- Node.js 18 or newer (`node -v` to confirm); install via [nodejs.org](https://nodejs.org/) or your package manager.
- Docker Engine + Docker Compose v2.
- `make`, `curl`, `openssl`, `awk`, and `sed` available on your PATH.
- Optional: API keys for VirusTotal, Google Safe Browsing, urlscan.io, WhoisXML, and PhishTank. You can skip these during setup and fill them in later.

## Running the Wizard

```bash
chmod +x setup.sh   # one time
./setup.sh
```

### Flow Highlights

1. **Plan the run:** Pick whether to pull latest images, stop prior containers, or perform a destructive reset. Optionally specify a branch.
2. **Preflight:** The wizard checks for required tools, Docker daemon state, and repository structure.
3. **Environment prep:** `.env` is created/updated, secrets are generated, and integrations are explained with copy/paste prompts.
4. **Build & launch:** Containers are built and started with live progress indicators, and health checks run automatically.
5. **WhatsApp pairing:** Choose between RemoteAuth auto-pairing or QR flow, with optional audio cues from the pairing watcher.
6. **Postrun dashboard:** Observability URLs, control-plane token, missing integrations, and troubleshooting guidance are summarised.

## Non-Interactive / CI Mode

Use `./setup.sh --dry-run --noninteractive` (or set `SETUP_NONINTERACTIVE=1`) to exercise preflight, env configuration, and validation without prompts. Integrations default to disabled and missing keys are listed at the end.

- `--skip-preflight` lets CI or constrained sandboxes bypass Docker/command detection (combine with `--dry-run`).
- `--skip-api-validation` keeps the wizard from calling external APIs when running offline.

## Troubleshooting

- Port conflicts: adjust `REVERSE_PROXY_PORT` or `CONTROL_PLANE_PORT` in `.env` and re-run with `--clean`.
- Reset stack entirely: `./setup.sh --reset` (destroys database + WhatsApp session volumes).
- Pairing watcher anytime: `npm run watch:pairing-code`.

Refer to `docs/setup-wizard-happy-path-transcript.md` for an end-to-end example and `docs/setup-wizard-test-notes.md` for validation status.
