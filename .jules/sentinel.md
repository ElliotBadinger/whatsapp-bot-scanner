## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-12-08 - CSRF Token Derivation in Scaled Environments
**Vulnerability:** CSRF token defaulting to the authentication token defeats CSRF protection and risks credential exposure. Generating random CSRF tokens on module load fails in horizontally scaled environments.
**Learning:** We must not use stateful random tokens generated on module load for CSRF protection in scaled services without persistent shared storage.
**Prevention:** Use deterministic key derivation (e.g., hashing a master secret or API token with a salt) or shared storage to ensure consistent CSRF tokens across multiple service instances.
