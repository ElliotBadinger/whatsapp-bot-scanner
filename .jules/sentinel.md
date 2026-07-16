## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2024-07-16 - CSRF Token Generation

**Vulnerability:** The CSRF token was defaulting to the same value as the API token.
**Learning:** Using an authentication token directly as a CSRF token defeats the purpose of CSRF protection because both tokens are the same. In a horizontally scaled app, random CSRF generation at runtime can cause mismatches across instances.
**Prevention:** Ensure CSRF tokens are distinct from auth tokens. For stateless, horizontally-scaled services without shared storage, deterministically derive the CSRF token (e.g., hash the auth token with a salt) instead of random generation to avoid instance mismatches.
