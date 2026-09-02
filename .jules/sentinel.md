## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-12-21 - CSRF Token Generation

**Vulnerability:** The CSRF token was defaulting to the exact same value as the API token. This defeats the purpose of having a separate CSRF token if the API token gets leaked or if the CSRF token is exposed in logs or headers.
**Learning:** Reusing an authentication token as a CSRF token provides no additional security. A separate, decoupled token must be used to ensure defense in depth.
**Prevention:** If an explicit CSRF token is not provided in the environment configuration, deterministically derive it from the API token using a secure one-way hash (e.g., SHA-256 with a salt) rather than using the API token verbatim.
