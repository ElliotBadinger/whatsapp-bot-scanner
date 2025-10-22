# Security, Privacy, and Compliance

Security controls:
- Least privilege containers; no-root users; `no-new-privileges` in Compose.
- SSRF defenses: DNS-to-IP verification; private/loopback ranges blocked; protocol allowlist (http/https only); redirect and size limits.
- Outbound requests use explicit timeouts and small UA.
- Secrets only via env; never logged.

Privacy:
- Stores URL, minimal message context (chatId, messageId, senderId hash).
- Default retention: 30 days; purge job can be scheduled (see runbook).
- Consent template posted on join; opt-out respected via group mute setting.

Compliance:
- DPIA summary in `docs/THREAT_MODEL.md`.
- Data export/delete supported by SQL queries and purge scripts.

