## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-02-23 - Timing Attack via Non-Constant-Time Token Comparison

**Vulnerability:** The `createAuthHook` function in `control-plane` compared authentication tokens using strict equality (`===`). This exposed the application to timing attacks, allowing an attacker to measure response times to brute-force the expected token character by character.
**Learning:** Standard string comparisons stop at the first differing character, leaking the length of the matching prefix through timing side-channels. Variable length comparisons can also leak the expected token length.
**Prevention:** Always use `crypto.timingSafeEqual()` when verifying secrets (tokens, passwords, signatures). Before comparing, ensure both inputs are of equal length, for example by hashing them first using `crypto.createHash('sha256').update(value).digest()`.
