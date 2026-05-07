## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-12-21 - Non-Constant-Time Token Comparison

**Vulnerability:** Comparing sensitive tokens (e.g., authorization headers) using strict string equality (`===` or `!==`) exposes the application to timing attacks, allowing attackers to incrementally brute-force tokens based on response times.
**Learning:** `crypto.timingSafeEqual()` requires inputs to be of equal length. Using strings of different lengths directly or failing to handle unequal lengths causes application errors or exposes timing differences.
**Prevention:** Convert string tokens to `Buffer` objects using UTF-8 encoding. Explicitly check that `buffer1.length === buffer2.length` before calling `crypto.timingSafeEqual(buffer1, buffer2)`.
