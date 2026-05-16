## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-05-20 - AUTH-004 CSRF Token Defaults to API Token
**Vulnerability:** The CSRF protection token defaulted to the API authentication token if not explicitly set, which means obtaining the CSRF token gives full API access, defeating CSRF protection.
**Learning:** Reusing existing tokens for fallback security parameters creates a single point of failure. In horizontally scaled environments, random fallback token generation breaks token matching.
**Prevention:** Use deterministic derivation (e.g., hashing a master secret) to safely generate fallback secondary tokens without compromising the master secret or breaking distributed token matching.
