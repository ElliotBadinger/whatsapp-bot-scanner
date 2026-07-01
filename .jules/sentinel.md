## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-02-28 - CSRF Token Generation
**Vulnerability:** The CSRF token was defaulting to the API token if not explicitly set, which means the CSRF protection token was the same as the authentication token, defeating the purpose of CSRF protection.
**Learning:** Never reuse authentication tokens for CSRF protection as an attacker who obtains the API token also trivially bypasses CSRF checks.
**Prevention:** Generate a separate CSRF token using cryptographic derivation (like `crypto.createHash`) if an explicit one is not set, ensuring it is deterministic for horizontal scaling.
