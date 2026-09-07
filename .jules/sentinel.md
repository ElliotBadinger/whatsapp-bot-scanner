## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-02-28 - CSRF Token Derivation using Deterministic Hashing

**Vulnerability:** CSRF token defaulting to the same value as the authentication API token.
**Learning:** The application's `config.controlPlane.csrfToken` defaults to the exact `CONTROL_PLANE_API_TOKEN` if not set, defeating CSRF protection.
**Prevention:** Derive the CSRF token via deterministic hashing using a master secret and a salt, rather than stateful random tokens.
