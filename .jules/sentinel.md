## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2024-05-15 - CSRF Token Conflation with Auth Token

**Vulnerability:** The CSRF token was defaulting to the main API authentication token when not explicitly configured, effectively using the same secret for both auth and CSRF protection.
**Learning:** Reusing authentication secrets for CSRF protection defeats the purpose of CSRF, as it exposes the auth token in forms/headers meant for CSRF. Using `crypto.randomBytes` on load fails in scaled environments due to mismatch across instances.
**Prevention:** Use a deterministic derivation (e.g., hashing the auth token with a salt) to generate a distinct but consistent CSRF fallback token across horizontally scaled instances without stateful storage.
