## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-07-15 - Missing CSRF Protection Separation

**Vulnerability:** The CSRF token was reusing the exact same value as the authentication token (`process.env.CONTROL_PLANE_API_TOKEN`). This provides no additional protection as an attacker who steals the authentication token also immediately has the CSRF token.
**Learning:** Reusing the same token for both authentication and CSRF protection defeats the purpose of CSRF checks. Authentication proves identity, while CSRF tokens prove the origin of the request.
**Prevention:** Generate a separate CSRF token using cryptographically secure methods, like `crypto.createHash('sha256').update(authToken + 'csrf').digest('hex')` or `crypto.randomBytes()`.
