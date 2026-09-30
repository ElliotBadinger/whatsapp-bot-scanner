## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-02-28 - [CRITICAL] Fixed CSRF Token Authentication Bypass

**Vulnerability:** The CSRF token was defaulting to the plain API token `(process.env.CONTROL_PLANE_CSRF_TOKEN || getControlPlaneToken())`. This defeats the purpose of CSRF protection since an attacker possessing the CSRF token now holds the API authentication token.
**Learning:** Default fallback logic for security tokens should never reuse authentication tokens. Tokens for different purposes must be computationally separate, e.g., using a cryptographically secure hash.
**Prevention:** Use `crypto.createHash` to deterministically derive the CSRF token from the API token with a static salt if an explicit CSRF token is not set, breaking the mathematical equivalence.
