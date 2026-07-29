## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2023-10-24 - CSRF Token Reuse

**Vulnerability:** The CSRF token in `packages/shared/src/config.ts` reused the authentication token (`CONTROL_PLANE_API_TOKEN`) directly.
**Learning:** This defeats the purpose of CSRF protection because if an attacker compromises the API token, they also obtain the CSRF token.
**Prevention:** The CSRF token was updated to derive a deterministic hash using the API token and a salt (`crypto.createHash('sha256').update(token).update('csrf-salt').digest('hex')`). This enables horizontal scaling without relying on shared state for random CSRF tokens.
