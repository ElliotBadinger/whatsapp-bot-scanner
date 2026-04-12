## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2026-04-12 - Timing Attack Vulnerability in Token Comparison

**Vulnerability:** The API token verification in `services/control-plane` used the standard strict equality operator (`!==`) to compare the provided token against the expected token.
**Learning:** Standard string comparison operators exit early as soon as a mismatch is found. This enables timing attacks where an attacker can measure the response time to guess the secret token character by character.
**Prevention:** Always use `crypto.timingSafeEqual()` when comparing secrets like passwords, API keys, or tokens. Remember to verify that the buffers being compared have the exact same length before calling `timingSafeEqual()` to avoid a `RangeError`.
