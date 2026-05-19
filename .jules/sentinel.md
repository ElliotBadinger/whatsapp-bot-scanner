## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2024-05-24 - Metrics Endpoint Exposure Fixed
**Vulnerability:** The `/metrics` endpoint in the control-plane service was publicly accessible because it was registered before the Fastify authentication hook, potentially exposing internal system state and metrics (INFO-004).
**Learning:** Endpoints that seem "internal" like `/metrics` or `/healthz` must still be evaluated for data leakage. While health checks are often public, detailed Prometheus metrics can leak queue depths, error rates, and traffic patterns to unauthenticated attackers.
**Prevention:** Always register administrative and monitoring endpoints inside authenticated sub-applications or apply explicit authentication hooks to them. Validate routing order when using Fastify hooks.
