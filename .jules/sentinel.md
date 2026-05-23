## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-12-21 - Timing Attack Vulnerability in Token Comparison

**Vulnerability:** The API token comparison in `createAuthHook` (Fastify) used a standard string equality operator (`===` or `!==`), making it susceptible to timing attacks where an attacker could theoretically determine the valid token character by character based on comparison time.
**Learning:** String comparisons in authentication checks must always use constant-time operations to prevent timing attacks.
**Prevention:** Always use `crypto.timingSafeEqual()` for comparing secrets (tokens, passwords, HMACs) in Node.js. Ensure you compare lengths first before calling it, as `timingSafeEqual` throws if buffer lengths differ.
