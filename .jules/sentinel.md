## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-03-03 - Control Plane Metrics Endpoint Authentication
**Vulnerability:** The `/metrics` endpoint in the `control-plane` service was publicly accessible without any authentication, exposing internal application metrics, queue sizes, and potentially sensitive operational data to anonymous users.
**Learning:** Fastify routes registered outside of a protected block (with an authentication hook) bypass the security controls intended for administrative endpoints. Metrics endpoints are high-value targets for reconnaissance in containerized environments.
**Prevention:** Always register internal administrative endpoints, such as `/metrics`, `/health`, or `/status`, inside authenticated router scopes unless they are explicitly intended as public liveness probes (e.g. `/healthz`). Add automated tests that verify endpoints correctly reject unauthenticated requests (401 Unauthorized) to prevent regressions.
