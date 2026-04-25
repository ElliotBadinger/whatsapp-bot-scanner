## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-12-21 - CSRF Token Fallback Insecurity

**Vulnerability:** The application was falling back to using the raw `CONTROL_PLANE_API_TOKEN` as the `CONTROL_PLANE_CSRF_TOKEN` when the latter was omitted. This risks leaking the highly privileged API token in contexts where only the CSRF token is required.
**Learning:** Hardcoded stateful fallback tokens or relying directly on root authentication secrets for secondary protection layers defeats defense-in-depth principles.
**Prevention:** If a distinct token isn't provided, cryptographically derive it from the main secret (e.g., using `crypto.createHash('sha256').update(secret).update('salt').digest('hex')`) rather than reusing the secret itself.
