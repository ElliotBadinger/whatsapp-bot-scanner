## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-01-08 - CSRF Token Defaults to API Token

**Vulnerability:** The CSRF token in configuration defaulted to the API authentication token if not explicitly provided, meaning the CSRF token was the exact same value as the auth token, defeating CSRF protection.
**Learning:** When falling back to alternative secrets to generate tokens, reusing an authentication token directly violates defense-in-depth principles. They must remain separate and distinct values.
**Prevention:** Use deterministic key derivation/hashing (`crypto.createHash('sha256').update(token).update(salt).digest()`) to safely derive secondary keys/tokens from a primary token without exposing the primary value.
