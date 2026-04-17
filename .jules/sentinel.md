## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-12-21 - Non-Constant-Time Token Comparison

**Vulnerability:** The authentication hook compared secrets via standard string equality (`!==`). This is vulnerable to timing attacks where an attacker can measure response times to guess the token character by character.
**Learning:** Checking string equality for authentication logic allows timing variations which might leak secret material.
**Prevention:** Always convert expected and input strings to Buffers and use `crypto.timingSafeEqual()` for secret and token comparisons. Before doing so, check buffer length equality as `timingSafeEqual` will throw on lengths mismatch.
