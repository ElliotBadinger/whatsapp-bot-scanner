## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.
## 2025-02-28 - Fastify timing attacks in authorization hooks
**Vulnerability:** Fastify header validation for authentication tokens used basic strict equality (`!==`) which creates a vulnerability for a timing attack where tokens can be brute forced character by character.
**Learning:** Comparing tokens across the platform needs to use `crypto.timingSafeEqual` and it's much safer to convert strings to buffers by hashing them instead of simply transforming to `Buffer` object (which might run into byte length issues if `timingSafeEqual` receives two inputs of different length).
**Prevention:** Make sure all security string comparisons employ `crypto.timingSafeEqual` accompanied by SHA-256 pre-hashing instead of normal equality checks.
