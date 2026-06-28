## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-12-23 - CSRF Token Defaults to API Token

**Vulnerability:** The CSRF token was defaulting to the exact same value as the API token. This defeated the purpose of having a CSRF token because if an XSS vulnerability allowed an attacker to read the CSRF token, it would instantly hand them the API token since they are exactly the same value.
**Learning:** Reusing authentication tokens for CSRF validation is a common misconfiguration. CSRF tokens should be derived from the API token (or other user authentication state) so that an attacker cannot guess the CSRF token just by having the auth token or observing other API requests.
**Prevention:** Generate a separate CSRF token, either using crypto.randomBytes() if the token is stored on the server side or client, or by using a hashing algorithm (like HMAC or SHA256) combined with a secret salt to derive a CSRF token from the API token without storing state on the server.
