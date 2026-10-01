## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.
## 2025-05-18 - Auth Hook Timing Attack and Metrics Exposure
**Vulnerability:** The API token verification in `createAuthHook` used a simple string comparison susceptible to timing attacks. Additionally, the `/metrics` endpoint was incorrectly exposed publicly without authentication.
**Learning:** Using `!==` for string comparison of tokens is susceptible to timing attacks, allowing an attacker to determine the token character by character. Also, all administrative and non-public routes should be explicitly registered inside the `protectedApp` block to ensure they inherit the `createAuthHook`.
**Prevention:** Use `crypto.timingSafeEqual()` to perform constant-time comparisons when verifying authentication tokens. Ensure proper placement of routes inside authenticated blocks, especially administrative endpoints like `/metrics`.
