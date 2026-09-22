## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-12-08 - CSRF Token Generation

**Vulnerability:** CSRF token defaulting to API token (AUTH-004), leaving the app vulnerable to CSRF if left implicitly configured or potentially leaking API tokens.
**Learning:** For horizontally scaled apps, do not generate stateful random tokens on module load (e.g. `crypto.randomBytes()`). This causes mismatch across instances. Use deterministic derivation (`crypto.createHash('sha256').update(masterSecret).digest()`) or persistent shared storage instead.
**Prevention:** Always ensure CSRF generation is separated from Auth, and explicitly handled for scaled instances via derived or persistent strategies.
