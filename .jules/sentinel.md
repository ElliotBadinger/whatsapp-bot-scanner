## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2024-08-01 - Derived CSRF Token

**Vulnerability:** The CSRF token was defaulting directly to the API token if no explicit CSRF token was provided. This means if a CSRF token was ever leaked, it would compromise the highly-privileged API token.
**Learning:** Default fallbacks must not lower the security posture by reusing credentials designed for different purposes.
**Prevention:** If a distinct configuration variable is missing, securely derive fallback values (e.g. by hashing the master secret using SHA-256) rather than directly reusing the secret. Also ensure that tests mocking configuration objects contain necessary module imports when injecting standard library functions like `crypto`.
