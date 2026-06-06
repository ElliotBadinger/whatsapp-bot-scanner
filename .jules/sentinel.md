## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2026-06-06 - Insecure CSRF Token Derivation

**Vulnerability:** The CSRF token was defaulting to the same value as the authentication API token. This defeated the purpose of CSRF protection by reusing the primary authentication credential.
**Learning:** When falling back for a CSRF token in a horizontally scaled environment without shared storage, generating a stateful random token (e.g., `crypto.randomBytes()`) on module load causes token mismatches across instances.
**Prevention:** Use a deterministic derivation method (e.g., hashing a master secret with a salt: `crypto.createHash('sha256').update(masterSecret).update('salt').digest('hex')`) instead of reusing the auth token directly or generating a random token on module load.
