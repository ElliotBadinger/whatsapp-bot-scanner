## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2024-05-24 - [Secure Control Plane Metrics Endpoint]

**Vulnerability:** The `/metrics` endpoint in `services/control-plane/src/index.ts` was publicly accessible (registered before the authentication hook). This could expose sensitive internal state, queue depths, and error rates via Prometheus metrics.
**Learning:** In Fastify, routes registered before the `protectedApp.addHook("preHandler", ...)` block are public. Moving the route inside the `app.register(async (protectedApp) => {...})` block secures it.
**Prevention:** Always verify that sensitive endpoints (like metrics or administration) are registered inside the authenticated scope block, leaving only explicitly public endpoints (like `/healthz`) outside.
