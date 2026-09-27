## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.
## 2025-12-21 - Timing Attack Vulnerability in Secret Comparison
**Vulnerability:** Comparing sensitive secrets like the URLScan callback token using the standard `!==` operator is vulnerable to timing attacks. Attackers can guess the secret character by character by measuring response times.
**Learning:** Using `crypto.timingSafeEqual()` requires both inputs to be buffers of the same length. Checking their lengths prior to calling `timingSafeEqual` introduces another timing vulnerability (leaking the exact expected length).
**Prevention:** To securely compare variable-length secrets and avoid leaking length information, first compute a cryptographic hash (e.g., SHA-256) of both strings, and then use `crypto.timingSafeEqual()` on the resulting fixed-length hashes.
