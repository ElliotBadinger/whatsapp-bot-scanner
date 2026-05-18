## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-01-01 - Prevent CSRF Token Defaulting to API Token
**Vulnerability:** The CSRF token was defaulting to the plain `CONTROL_PLANE_API_TOKEN`, meaning the CSRF protection token was the exact same as the authentication token. This defeats the purpose of CSRF protection by exposing the auth token.
**Learning:** Using an auth token as a fallback for a CSRF token compromises the auth token and undermines CSRF defense.
**Prevention:** Generate a separate CSRF token or deterministically derive one (e.g. via `HMAC` with a salt) from the auth token so the raw auth token is not exposed.
