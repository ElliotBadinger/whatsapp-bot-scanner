## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-12-08 - Fixed Non-Constant-Time Token Comparison

**Vulnerability:** The API token authentication hook (`createAuthHook` in `services/control-plane/src/index.ts`) compared tokens using standard string equality (`===`). This is vulnerable to timing attacks, allowing an attacker to deduce the token character by character.
**Learning:** Security tokens must be compared using constant-time comparison methods. Additionally, `crypto.timingSafeEqual` requires the buffers to be of equal length; otherwise, it throws an error.
**Prevention:** Always use `crypto.timingSafeEqual` for comparing secrets, tokens, or hashes. Ensure both strings are converted to `Buffer` and their lengths are explicitly checked before calling `timingSafeEqual`.
