## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-01-21 - Deterministic Derivation of CSRF Tokens
**Vulnerability:** The CSRF token in the control plane defaulted to the authentication API token if not explicitly set, defeating the purpose of CSRF protection by reusing the authentication token.
**Learning:** In horizontally scaled environments, generating stateful random fallback tokens on module load causes token mismatches across instances.
**Prevention:** Use deterministic derivation (e.g., hashing a master secret or API token) or persistent shared storage for fallback tokens instead of runtime random generation or direct reuse.
