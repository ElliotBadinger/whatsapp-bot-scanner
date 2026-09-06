## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-03-09 - [Non-Constant-Time Token Comparison Fixed]
**Vulnerability:** AUTH-001: The createAuthHook function compared tokens using strict equality (===), allowing timing attacks to brute-force the API token.
**Learning:** Using basic string comparison for tokens leaks timing information as it exits early upon encountering a mismatch.
**Prevention:** Always use `crypto.timingSafeEqual` along with checking for equal Buffer lengths when comparing secrets.
