## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2024-07-04 - [Fix] Timing Attack in Authentication Hook
**Vulnerability:** The authentication hook (`createAuthHook`) used a standard string equality check (`token !== expectedToken`) to verify bearer tokens, making the application vulnerable to timing attacks.
**Learning:** Standard string comparisons fail fast on the first mismatched character. An attacker can use the microscopic timing differences to guess the secret token character by character.
**Prevention:** Always use `crypto.timingSafeEqual` when comparing security tokens, passwords, or signatures. To safely handle tokens of arbitrary or different lengths, hash both tokens before comparison.
