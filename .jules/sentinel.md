## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-05-27 - Fallback Security Tokens in Horizontally Scaled Apps

**Vulnerability:** The CSRF token in the application (`CONTROL_PLANE_CSRF_TOKEN`) defaulted to the API token (`CONTROL_PLANE_API_TOKEN`) if unset, defeating its purpose (AUTH-004). Generating a random token on module load via `crypto.randomBytes` would break horizontally scaled environments because each instance would generate a different token, causing state mismatch.
**Learning:** Fallback security mechanisms like CSRF tokens require consistency across instances. In stateless architectures or those without persistent shared token storage, fallback tokens must be derived deterministically rather than generated dynamically upon service startup.
**Prevention:** Instead of reusing another sensitive token or using dynamic random bytes, use deterministic derivation by hashing a master secret or an existing token combined with a fixed secret string (e.g., `crypto.createHash("sha256").update(token + "csrf-fallback-secret").digest("hex")`). This ensures horizontally scaled instances compute the same value.
