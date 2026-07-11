## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-07-11 - CSRF Protection Defeated by Token Reuse
**Vulnerability:** The CSRF token was defaulting to the same value as the main API authentication token (`getControlPlaneToken()`). This defeats the purpose of having a separate CSRF token and exposes the API if the CSRF token is leaked or if a CSRF attack simply replays the auth token.
**Learning:** Never reuse authentication tokens for CSRF protection. In horizontally scaled environments, stateful random tokens generated on module load cause mismatches.
**Prevention:** Use deterministic derivation (e.g., hashing a master secret using `crypto.createHash`) or persistent shared storage for CSRF tokens to ensure consistency across instances without reusing auth tokens.
