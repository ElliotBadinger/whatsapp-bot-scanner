## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-12-21 - CSRF Token Generation Issue

**Vulnerability:** The CSRF token was defaulting to the API token if not explicitly set, which defeats the purpose of CSRF protection since the same token was used for both authentication and CSRF.
**Learning:** Reusing an API token for CSRF protection is equivalent to having no CSRF protection, as an attacker with the API token or an XSS vulnerability could perform actions on behalf of the user. In horizontally scaled environments, avoid generating stateful random tokens on module load (e.g., using `crypto.randomBytes()`). This causes token mismatch across instances.
**Prevention:** Use deterministic derivation (e.g., hashing a master secret like `crypto.createHash('sha256').update(apiToken + ':csrf-salt').digest('hex')`) or persistent shared storage instead.
