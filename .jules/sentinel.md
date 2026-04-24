## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-12-21 - CSRF Token Fallback exposes Authentication Token

**Vulnerability:** The CSRF token in the Control Plane (`config.controlPlane.csrfToken`) defaulted to returning the Authentication Token (`CONTROL_PLANE_API_TOKEN`) if `CONTROL_PLANE_CSRF_TOKEN` was not set. This defeated the purpose of CSRF protection by reusing the same secret for both auth and CSRF mitigation.
**Learning:** In horizontally scaled environments, you cannot simply generate a random token on module load (like using `crypto.randomBytes()`) because the tokens will mismatch across instances. We needed a deterministic fallback that was still secure.
**Prevention:** Always ensure CSRF tokens are cryptographically separate from Authentication tokens. If a fallback is needed and you lack persistent storage, securely derive the CSRF token by hashing the authentication token with a known salt (e.g. `crypto.createHash("sha256").update(token + "salt").digest("hex")`), guaranteeing deterministic values across instances without exposing the original token.
