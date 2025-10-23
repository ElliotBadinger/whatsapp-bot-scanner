# Security, Privacy, and Compliance

Security controls:
- Least privilege containers; no-root users; `no-new-privileges` in Compose.
- SSRF defenses: DNS-to-IP verification; private/loopback ranges blocked; protocol allowlist (http/https only); redirect and size limits.
- Outbound requests use explicit timeouts and small UA.
- Secrets only via env; never logged.
- Rate limiting: Redis-backed per-group, per-hour, and global guards mitigate spam amplification and brute-force attempts against admin commands.
- Control Plane protected by bearer tokens; WhatsApp admin commands validated against group admin roster before executing rescans or mutes.

Privacy:
- Stores URL, minimal message context (chatId, messageId, senderId hash).
- Default retention: 30 days; purge job can be scheduled (see runbook).
- Consent template posted on join; opt-out respected via group mute setting.
- urlscan artifacts (screenshot + DOM) are saved under `storage/urlscan-artifacts` with hostname whitelisting and served via signed hash routes to avoid path traversal.

Compliance:
- DPIA summary in `docs/THREAT_MODEL.md`.
- Data export/delete supported by SQL queries and purge scripts.
- urlscan callback secret enforced via header/query token; disable urlscan or purge artifacts when handling deletion requests.

