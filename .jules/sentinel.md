## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2024-05-30 - Fix Information Disclosure on Metrics Endpoint
**Vulnerability:** The `/metrics` endpoint in the `control-plane` service was registered before the authentication hook, making it publicly accessible without a token. This could expose Prometheus metrics containing internal system state, queue depths, and error rates to unauthenticated attackers.
**Learning:** Fastify registers hooks hierarchically. Endpoints defined before an `app.register()` block with an `addHook` (like the authentication check) will not be protected. Critical administrative endpoints must be explicitly placed inside the authenticated block.
**Prevention:** Ensure all non-public administrative routes, including observability endpoints like `/metrics`, are registered within the `app.register()` block that configures the `preHandler` authentication hook.
