## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2026-05-10 - Non-Constant-Time Token Comparison

**Vulnerability:** The `createAuthHook` function in the control plane compared authentication tokens using strict equality (`!==`). This is vulnerable to timing attacks where an attacker can measure response times to brute-force the token character by character.
**Learning:** Standard string comparisons in JavaScript short-circuit upon finding the first difference, leaking information about the matching prefix length through execution time.
**Prevention:** To prevent timing attacks when comparing string secrets (e.g., authentication tokens), use `crypto.timingSafeEqual()`. Because it throws an error if buffer lengths mismatch, explicitly check for length equality (`buf1.length !== buf2.length`) after converting strings to Buffers (`Buffer.from(token, 'utf8')`) before calling `timingSafeEqual`.
