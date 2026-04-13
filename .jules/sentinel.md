## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-12-21 - Non-Constant-Time Token Comparison Vulnerabilities
**Vulnerability:** Timing attack vulnerabilities were found during authentication/secret validation due to the use of strict equality operators (`===` or `!==`) to compare strings (`createAuthHook` in control-plane and `handleUrlscanCallback` in scan-orchestrator).
**Learning:** Comparing tokens or secrets directly with Javascript equality operators leaks information. Because execution time stops upon the first character mismatch, an attacker could sequentially measure response times to guess valid tokens character by character.
**Prevention:** Always compare sensitive secrets using `crypto.timingSafeEqual()`. Make sure to cast strings to equal-length `Buffer` representations via `Buffer.from(value, 'utf8')` prior to utilizing `timingSafeEqual()`.
