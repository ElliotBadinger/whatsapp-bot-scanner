## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-02-18 - Missing Rate Limiting on Sensitive Control Plane Endpoints

**Vulnerability:** The `services/control-plane` API lacked rate limiting on critical endpoints like `/rescan` (resource intensive) and `/overrides` (admin action), despite having the necessary rate-limiting infrastructure in `@wbscanner/shared`.
**Learning:** Having security utilities available in a shared library does not guarantee they are used. Service initialization code must explicitly wire up these utilities. In this case, `createApiRateLimiter` was imported but not instantiated or attached to routes.
**Prevention:** Implement a secure-by-default service template or middleware that automatically applies default rate limits to all routes, requiring explicit opt-out for high-throughput internal endpoints. Add integration tests that specifically probe for 429 responses.
