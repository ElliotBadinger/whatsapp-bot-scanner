## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2024-05-30 - CSRF Token Reuse of Authentication Tokens

**Vulnerability:** The CSRF token was defaulting to the authentication API token when not explicitly configured, completely undermining CSRF protection by exposing the auth token.
**Learning:** When implementing fallback CSRF tokens in horizontally scaled environments where `crypto.randomBytes()` causes mismatch across instances, using deterministic derivation (hashing the master secret) provides secure, consistent tokens.
**Prevention:** Never reuse authentication tokens directly for other security mechanisms. Always use deterministic derivation or persistent shared storage for fallback security tokens across scaled environments.
