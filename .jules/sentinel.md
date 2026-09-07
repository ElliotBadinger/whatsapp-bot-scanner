## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-01-24 - CSRF Token Reuse and Timing Attacks

**Vulnerability:** The CSRF token was defaulting to the raw authentication token, defeating its purpose. Additionally, token comparisons were susceptible to timing attacks.
**Learning:** Defaulting secondary authentication tokens to the primary secret bypasses layered security (Defense in Depth). Also, simple string comparisons for secrets leak length/content through timing.
**Prevention:** Derive secondary tokens deterministically using a secure hash (e.g., SHA-256 with salt) and compare sensitive secrets using `crypto.timingSafeEqual()`.
