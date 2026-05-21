## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2026-05-21 - CSRF Token Derived from Authentication Token
**Vulnerability:** The CSRF token was defaulting to the exact same value as the API Authentication token (`CONTROL_PLANE_API_TOKEN`), defeating the purpose of CSRF protection by reusing authentication secrets.
**Learning:** In horizontally scaled environments, we cannot generate a random stateful CSRF token on startup (e.g. `crypto.randomBytes()`) because instances would have mismatched tokens.
**Prevention:** Use a deterministic derivation method (e.g. `crypto.createHash('sha256').update(apiToken).update('csrf-salt').digest('hex')`) to generate a unique, non-reversible CSRF token that stays consistent across all scaled instances without sharing the same value as the auth token.
