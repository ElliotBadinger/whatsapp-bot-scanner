## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-12-23 - CSRF Token Fallback Reuse

**Vulnerability:** The application was using the raw API authentication token as a fallback CSRF token when none was explicitly configured. This defeated the purpose of CSRF protection because an exposed CSRF token would directly compromise the authentication credentials.
**Learning:** Hardcoding or reusing the primary authentication token as a CSRF token in config falls back violates defense-in-depth principles.
**Prevention:** Always cryptographically derive fallback tokens from master secrets (e.g., using HMAC-SHA256) rather than returning the raw secret directly, ensuring irreversible separation of concerns while retaining deterministic validation.
