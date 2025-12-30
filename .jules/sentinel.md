## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-12-21 - Credential Exposure in Structured Logs

**Vulnerability:** WhatsApp pairing codes were being logged in cleartext via `logger.info()` in `wa-client`. While these codes are short-lived, exposing them in persisted logs allows any user with log access to pair their own device and hijack the WhatsApp session.
**Learning:** Developers often log "useful" information for debugging without realizing it contains sensitive credentials. Pairing codes, OTPs, and tokens should never enter the structured logging pipeline.
**Prevention:** Use `process.stdout.write` for interactive user prompts (like pairing codes) that are transient and not meant for storage. Explicitly sanitize or exclude sensitive fields from structured log objects.
