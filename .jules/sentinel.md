## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2026-04-01 - [AUTH-001/AUTH-002: Timing Attack vulnerability]

**Vulnerability:** Simple string comparison (`token !== expectedToken`) was used for checking the API token in `services/control-plane/src/index.ts`.
**Learning:** Simple string equality checks terminate early upon the first mismatching character, leaking information about the token's content through execution time differences, making the system vulnerable to timing attacks.
**Prevention:** Use `crypto.timingSafeEqual()` to compare sensitive secrets like tokens. Ensure buffer lengths are verified before calling `timingSafeEqual` to avoid TypeError crashes, or hash them first.
