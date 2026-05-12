## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-12-21 - CSRF Token Fallback Matches Auth Token

**Vulnerability:** The CSRF token generation used the authentication API token as a fallback when a specific CSRF token was not configured. This defeats the purpose of CSRF protection by making the CSRF token known to anyone who can observe the auth token.
**Learning:** In horizontally scaled environments, fallback tokens shouldn't be stateful (e.g. `crypto.randomBytes()`) because they will mismatch across instances, but they also shouldn't blindly reuse auth tokens.
**Prevention:** Use deterministic derivation (like hashing a master secret/auth token with a salt) to generate consistent fallback tokens across scaled instances without exposing the original secret.
