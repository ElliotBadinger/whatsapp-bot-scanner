## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-12-22 - CSRF Token Neutralization via Direct Reuse of API Token

**Vulnerability:** The application derived its fallback `CSRF_TOKEN` by defaulting directly to the `CONTROL_PLANE_API_TOKEN`.
**Learning:** Defaulting a CSRF token to an API token neutralizes CSRF protections because an attacker with access to the API token implicitly bypasses the CSRF check. This occurs in horizontally scaled environments where persistent storage for tokens isn't viable and token values must be predictable, causing developers to reuse existing secrets.
**Prevention:** Always use deterministic derivation (e.g., hashing a master secret with a salt) or persistent shared storage instead of reusing existing tokens directly.
