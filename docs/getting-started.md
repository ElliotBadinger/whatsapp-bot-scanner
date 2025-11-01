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

## Onboarding Modes & Controls
- **Guided vs Expert:** Guided remains the default narrative; press `v` (or pass `--mode=expert`) to collapse messaging into ≤10 lines per phase. The preference is cached in `.setup/preferences.json` for future runs.
- **Hotkeys:** `v` toggle verbosity, `g` open/close the glossary, `r` surface recovery shortcuts, `h` list all hotkeys, `q` request a safe abort. All cues respect `NO_COLOR=1` and `FORCE_HIGH_CONTRAST=1`.
- **Recovery toolkit:** `--quick=preflight` re-runs dependency checks, `--quick=resume-docker` jumps straight to container launch, and `--quick=purge-caches` wipes `.setup/` plus recent transcripts. Combine with `--resume=<preflight|environment|containers>` to pick a checkpoint.
- **Artifacts:** Every run exports `logs/setup-YYYYMMDD-HHmm.md` and `.json` with secrets redacted, decisions recorded, and resume hints for support. Attach the Markdown file when opening tickets.
- **Contextual help:** “Why this matters” callouts accompany risky prompts, and the glossary hotkey expands definitions for terms like *checkpoint*, *transcript*, and *quick action*.
- **Accessibility:** Long-running phases emit audible bells and a plain-text caption; keyboard-only navigation mirrors the hotkeys above.

![Guided vs Expert toggle](./assets/setup-mode-toggle.gif)

## Non-Interactive / CI Mode
Use `./setup.sh --dry-run --noninteractive` (or set `SETUP_NONINTERACTIVE=1`) to exercise preflight, env configuration, and validation without prompts. Integrations default to disabled and missing keys are listed at the end.

### CI/Test Harness Overrides
When automating smoke checks (e.g., in CI), add the following environment variables to avoid mutating your local `.env` or requiring Docker:

- `SETUP_ENV_PATH=/tmp/wbscanner.env` writes artifacts to an isolated file.
- `SETUP_SKIP_PREREQUISITES=1` skips host dependency checks (use only in controlled pipelines).
- `SETUP_SKIP_DOCKER=1` and `SETUP_SKIP_PORT_CHECKS=1` bypass Docker/port probing during dry runs.

These toggles are intentionally undocumented in the interactive wizard and should not be used for real onboarding runs.

## Troubleshooting
- Port conflicts: adjust `REVERSE_PROXY_PORT` or `CONTROL_PLANE_PORT` in `.env` and re-run with `--clean`.
- Reset stack entirely: `./setup.sh --reset` (destroys database + WhatsApp session volumes).
- Pairing watcher anytime: `npm run watch:pairing-code`.

Refer to `docs/setup-wizard-happy-path-transcript.md` for an end-to-end example and `docs/setup-wizard-test-notes.md` for validation status.
