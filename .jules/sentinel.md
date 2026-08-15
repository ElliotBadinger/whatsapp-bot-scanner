## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-08-15 - AUTH-004: Prevent CSRF Token Reusing API Token
**Vulnerability:** The application was reusing the authentication API token as the CSRF token if an explicit CSRF token was not configured. This defeats CSRF protection by conflating access control logic.
**Learning:** Default configuration fallbacks for security tokens must derive a deterministic secret securely (e.g., via SHA256 with a salt) or use a completely separate persistent secret, rather than reusing sensitive values like API keys verbatim.
**Prevention:** When implementing default tokens, never reuse existing API or auth tokens as plaintext fallbacks. Use deterministic derivation (`crypto.createHash`) or generate random ones using `crypto.randomBytes` (for stateful ones).
