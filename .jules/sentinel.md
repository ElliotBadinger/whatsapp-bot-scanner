## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2026-05-09 - Timing Attack in createAuthHook

**Vulnerability:** The `createAuthHook` function compared authentication tokens using standard equality (`!==`), which leaks information via execution timing and could enable brute-forcing via a timing attack.
**Learning:** String equality operators short-circuit, so the time it takes to compare them varies depending on the number of matching prefix characters.
**Prevention:** Use `crypto.timingSafeEqual` for all sensitive string comparisons. Remember to convert strings to Buffers first and check that lengths match before using `crypto.timingSafeEqual` as it throws on length mismatch.
