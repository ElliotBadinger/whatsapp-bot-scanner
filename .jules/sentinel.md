## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2024-12-01 - [Timing Attack in Auth Hook]

**Vulnerability:** The `createAuthHook` in the control-plane service used a standard string equality check (`===` / `!==`) for the authorization token.
**Learning:** Using simple string comparisons for sensitive tokens opens up the system to timing attacks, where an attacker can determine the token character by character by measuring the response time. `crypto.timingSafeEqual` should be used instead. Additionally, when using `timingSafeEqual`, the buffers must be the same length, which can be guaranteed by hashing the inputs first.
**Prevention:** Always use constant-time comparison functions like `timingSafeEqual` and handle variable-length inputs securely (e.g., via hashing) when comparing secrets.
