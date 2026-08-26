## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.
## 2024-08-26 - Control Plane CSRF Token Vulnerability
**Vulnerability:** The CSRF token for the control plane API defaults to the same value as the API token if not explicitly configured. This means the token meant to protect against Cross-Site Request Forgery is identical to the primary authentication token, completely defeating the purpose of CSRF protection.
**Learning:** Reusing authentication secrets for CSRF protection is a critical flaw. In horizontal scaling or test environments, the CSRF token should be either independently generated per session/request or deterministically derived (e.g., via hashing) from a primary secret along with a salt, rather than mirroring the secret exactly.
**Prevention:** Always ensure CSRF tokens are distinct from authentication tokens. If deterministic generation is required (e.g., to support multiple instances without shared state), use a cryptographic hash of the primary token combined with a specific salt, rather than using the raw token.
