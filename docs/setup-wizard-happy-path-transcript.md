# Happy Path Transcript – Guided Setup Wizard

*Captured on 2025‑11‑01 in an interactive terminal. Operator persona: Support Specialist (non-technical). Flags: none.*

```
$ ./setup.sh

╭──────────────────────────────────────────────────────────╮
│ WhatsApp Bot Scanner • Guided Setup                      │
│                                                          │
│ We will walk through 4 phases:                           │
│   1. Check your tools and repo state                     │
│   2. Configure environment + API keys                    │
│   3. Build and launch Docker stack                       │
│   4. Confirm WhatsApp pairing & next steps               │
│                                                          │
│ Estimated duration: ~8–12 minutes                        │
│ You can cancel anytime with Ctrl+C.                      │
╰──────────────────────────────────────────────────────────╯
? Ready to begin the guided setup? › (Y/n) y

? Choose any prep steps you would like us to handle before provisioning  (Press <space> to select, <return> to submit)
 ◉ Pull latest git commits and container images
 ◉ Stop running containers from previous setup
 ◯ Full reset (delete database + WhatsApp session)
? Do you want to checkout a specific git branch before continuing? No

==> Plan Summary
• Pull latest code/images: Yes
• Stop existing containers: Yes
• Full reset (delete database + WhatsApp session): No
• Target branch: Stay on current

? Proceed with this plan? › Yes

✔ Preflight checks
✔ Pulling latest updates
✔ Clean up previous runs

==> Preparing Environment
✔ Created .env from template.
? VirusTotal API Key — Paste the key (leave blank to skip) ▸ sk_live_••••1234
✔ VirusTotal key stored (redacted: ****1234).
? Google Safe Browsing API Key — Paste the key (leave blank to skip) ▸ AIz•••abcd
✔ Google Safe Browsing key stored (redacted: ****abcd).
? urlscan.io API Key — Paste the key (leave blank to skip) ▸ us_•••7890
✔ urlscan.io key stored (redacted: ****7890).
? WhoisXML (optional) API Key — leave blank ▸
⚠ WhoisXML (optional) disabled until API key is provided.
? PhishTank (optional) API Key — leave blank ▸
⚠ PhishTank (optional) integration skipped (optional).

==> Linking your WhatsApp
We can request a one-time code automatically and display it for ****7002.
? Request phone-number code automatically when services start? › Yes
✔ Auto pairing enabled. The pairing watcher can alert you when the code arrives.

✔ .env configured.
✔ Validating configuration
✔ Validating API keys
✔ Building containers
✔ Starting stack
✔ Waiting for core services

==> WhatsApp Pairing
Watching for phone-number pairing code targeting ****7002.
Open WhatsApp → Linked Devices → Link with phone number and enter the displayed code.
...
[10:48:32] WhatsApp client ready

==> Observability & Access
ℹ Reverse proxy: http://localhost:8088
ℹ Control plane UI: http://localhost:8088/
ℹ Grafana: http://localhost:3002 (admin / admin)
ℹ Control plane token (redacted): ****8a27

==> Pending API Keys
⚠ WhoisXML (optional) (optional) missing; add later for WHOIS enrichment.
⚠ PhishTank (optional) (optional) missing; registration currently limited.

==> Troubleshooting Tips
ℹ Missing API keys: re-run `./setup.sh` without `--noninteractive` or edit `.env` directly.
ℹ Port in use: adjust `REVERSE_PROXY_PORT` or `CONTROL_PLANE_PORT` inside `.env`, then rerun `./setup.sh --clean`.
ℹ Unexpected crashes: inspect `docker compose logs <service>` and `node scripts/validate-config.js`.

Setup complete. Re-run ./setup.sh anytime; operations are idempotent.
```

## Notes
- Transcript trimmed to highlight empathetic messaging and progress cues.
- Pairing watcher prompt accepted; operator heard the audible chime from `npm run watch:pairing-code`.
- Missing optional integrations surfaced in the post-run checklist for later follow-up.
