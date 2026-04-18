## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-12-21 - Timing attack via fast-fail string comparison

**Vulnerability:** The `createAuthHook` in `services/control-plane/src/index.ts` checked tokens using string equality (`token !== expectedToken`). Because JS string equality returns early on the first mismatched character, an attacker could potentially guess a valid token character by character via timing attack.
**Learning:** Security-sensitive string comparisons like authorization tokens need constant-time algorithms to avoid exposing length or matched character information in timing profiles.
**Prevention:** Always use `crypto.timingSafeEqual` for secret comparisons. Ensure Buffers are explicitly generated using `utf8` and enforce matching lengths before passing them to the function to prevent exceptions.
