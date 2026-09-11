## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-12-21 - CSRF Token Defaults to API Token Defeating CSRF Protection

**Vulnerability:** The CSRF token was defaulting to the exact same value as the API token (`process.env.CONTROL_PLANE_API_TOKEN`) when no explicit CSRF token was set. This completely circumvents CSRF protections because the token meant to secure state-changing actions was identical to the token used for standard authentication.
**Learning:** Using the same secret for both authentication and CSRF protection defeats the purpose of the synchronizer token pattern, as a compromised or leaked API token immediately exposes the application to CSRF attacks. If a unique token is absent, one must be deterministically derived (e.g., via hashing with a salt) from the API token instead of reusing it directly.
**Prevention:** Never use authentication tokens interchangeably with CSRF tokens. Always ensure that CSRF tokens are cryptographically distinct from auth tokens, either by requiring explicitly separated configured secrets or deriving a separate value safely (like hashing).
