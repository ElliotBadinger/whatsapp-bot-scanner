## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-12-23 - Timing Attack Vulnerability in Authentication Token Comparison
**Vulnerability:** The `createAuthHook` function in `control-plane` compared API tokens using strict string equality (`===`). This exposed the endpoint to timing attacks where an attacker could measure response times to guess the token character by character.
**Learning:** Basic string comparison operators (`===`, `!==`) fail-fast on the first differing character, leading to measurable timing differences.
**Prevention:** Always use constant-time comparison methods like `crypto.timingSafeEqual()` for comparing sensitive tokens, secrets, or passwords. Because `timingSafeEqual` throws on length mismatches, hash both values to a fixed length (e.g., SHA-256) before comparison.
