## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2026-04-23 - CSRF Token Reuse Vulnerability
**Vulnerability:** The default `csrfToken` in `packages/shared/src/config.ts` was identical to the `CONTROL_PLANE_API_TOKEN`. This defeated the purpose of CSRF protection by reusing the authentication token as the anti-CSRF token.
**Learning:** In horizontally scaled environments, stateful random tokens generated on module load (e.g., `crypto.randomBytes()`) cause token mismatch across instances. We cannot rely on randomized generation for default CSRF tokens across multiple running server instances.
**Prevention:** Deterministically derive tokens (e.g. CSRF token) using a cryptographic hash with a salt and the master secret, e.g., `crypto.createHash('sha256').update(masterSecret + "salt").digest('hex')`. This ensures each instance generates the identical, securely derived token without reusing the master secret directly.
