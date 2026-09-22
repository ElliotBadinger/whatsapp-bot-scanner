## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2024-05-24 - [Timing Attack in Auth Hook]

**Vulnerability:** The API token verification used standard string comparison (`!==`), allowing for timing attacks to figure out the token length and contents.
**Learning:** Node's `crypto.timingSafeEqual` checks buffers in constant time, but throws if lengths differ. Hashing both values first obscures lengths.
**Prevention:** Always use `crypto.timingSafeEqual` on hashes when comparing secrets, not strings.
