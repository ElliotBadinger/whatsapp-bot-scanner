## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2026-07-28 - [Security] Prevent CSRF token defaults to API token
**Vulnerability:** The CSRF token was defaulting to the same value as the API token in `config.ts`. This meant an attacker with the API token could also bypass CSRF protection.
**Learning:** Reusing authentication tokens for CSRF defeats the purpose of CSRF protection because they share the same compromise context.
**Prevention:** Always generate a separate CSRF token or use cryptographic derivation (e.g., hashing the API token) to ensure the tokens are distinct.
