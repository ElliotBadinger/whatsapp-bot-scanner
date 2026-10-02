## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.
## 2025-02-27 - [Fix timing attack vulnerability in token comparison]
**Vulnerability:** Found timing attack vulnerabilities in `createAuthHook` (services/control-plane) and `handleUrlscanCallback` (services/scan-orchestrator) where `expectedToken` and `secret` were being compared to incoming authorization headers using direct string equality operators (`===` or `!==`). This could allow attackers to bypass token validation via timing side-channels.
**Learning:** In Node.js applications, checking tokens byte by byte with `===` returns early when a mismatch occurs, allowing an attacker to deduce the exact valid token by measuring response times. A constant-time check mechanism must be used when comparing security tokens/secrets. Also, length difference checking requires special care in Fastify hooks / generic routes.
**Prevention:** Use `crypto.timingSafeEqual` consistently for any token comparison. Ensure `Buffer` length checking correctly manages fake/dummy comparisons before checking valid lengths to ensure true constant time.
