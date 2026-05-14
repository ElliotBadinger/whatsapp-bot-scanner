## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2026-05-14 - CSRF Token Defaults to Authentication Token
**Vulnerability:** The application's fallback CSRF token was defaulting to the exact same value as the API token.
**Learning:** Using the same token for both authentication and CSRF protection defeats the purpose of CSRF protection. In horizontally scaled environments, generating stateful random fallback tokens (e.g., using `crypto.randomBytes()`) causes mismatches across instances because each instance generates a different random token on module load.
**Prevention:** Derive fallback secondary tokens deterministically by hashing a primary secret (e.g., `createHash('sha256').update(apiToken).update('csrf-context').digest('hex')`). This ensures all scaled instances generate the identical fallback token without persistent shared storage.
