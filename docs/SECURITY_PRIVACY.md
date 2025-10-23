# Security, Privacy, and Compliance

Security controls:
- Least privilege containers; no-root users; `no-new-privileges` in Compose.
- SSRF defenses: DNS-to-IP verification; private/loopback ranges blocked; protocol allowlist (http/https only); redirect and size limits.
- Outbound requests use explicit timeouts and small UA.
- Secrets only via env; never logged.
- Rate limiting: Redis-backed per-group, per-hour, and global guards mitigate spam amplification and brute-force attempts against admin commands.
- Control Plane protected by bearer tokens; WhatsApp admin commands validated against group admin roster before executing rescans or mutes.

## External Threat Intelligence Obligations

- **Google Safe Browsing v4** — We process URLs with the Lookup API only after lowercasing/normalising to remove user identifiers. Responses are cached per SHA-256 hash and retained <24 h, satisfying the API usage policy. API keys are stored in environment variables and never logged or shared outside the orchestrator.
- **VirusTotal v3** — Enforcement includes a 4 req/min token bucket, quota gauges, and automated failover to URLhaus when quota or rate limits occur. Results are stored only as aggregate engine counts (not raw samples) to comply with redistribution limits.
- **Phishtank** — Requests identify the scanner via a dedicated user-agent string and optional app key; responses are cached for 1 h as allowed by the license. Attributions to the original reporter are preserved in persisted records.
- **URLhaus** — We respect the 1 req/s guidance by leveraging the same failover throttle that guards VirusTotal requests. Retrieved metadata is stored verbatim with source attribution to satisfy the sharing guidelines.
- **WhoisXML / RDAP** — WhoisXML usage is capped at the configured monthly quota; once exhausted the integration disables itself and alerts operators, preventing unapproved overage. RDAP calls use anonymous GETs and the returned datasets are cached for seven days.

Privacy:
- Stores URL, minimal message context (chatId, messageId, senderId hash).
- Default retention: 30 days; purge job can be scheduled (see runbook).
- Consent template posted on join; opt-out respected via group mute setting.
- urlscan artifacts (screenshot + DOM) are saved under `storage/urlscan-artifacts` with hostname whitelisting and served via signed hash routes to avoid path traversal.

Compliance:
- DPIA summary in `docs/THREAT_MODEL.md`.
- Data export/delete supported by SQL queries and purge scripts.
- urlscan callback secret enforced via header/query token; disable urlscan or purge artifacts when handling deletion requests.
