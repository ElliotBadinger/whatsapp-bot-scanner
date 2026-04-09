## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-12-21 - Fix Timing Attack Vulnerability in Token Validation

**Vulnerability:** The token validation logic in `services/control-plane/src/index.ts` used a simple string comparison (`token !== expectedToken`). This is vulnerable to timing attacks, where an attacker measures the time taken to reject a token to guess its value byte by byte.
**Learning:** Simple string comparisons for sensitive tokens can expose their contents through timing differences in execution. Node.js `crypto.timingSafeEqual` provides a constant-time comparison but requires buffers of equal length.
**Prevention:** Always use `crypto.timingSafeEqual()` when comparing security tokens, passwords, or HMACs. Ensure that length differences are handled without revealing information by either checking the lengths first or hashing both strings to equal lengths before comparison.
