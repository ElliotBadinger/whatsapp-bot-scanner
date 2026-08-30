## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2024-05-18 - [Metrics Endpoint Exposure]

**Vulnerability:** The `/metrics` endpoint in the control-plane service was publicly accessible because it was registered outside the authentication hook block, exposing internal system metrics (Prometheus).
**Learning:** In Fastify, the order of route registration matters, and any endpoint registered before a global or block-level `preHandler` hook bypasses it. The `/metrics` endpoint needs to be protected, unlike the `/healthz` endpoint.
**Prevention:** Register all sensitive endpoints within the authenticated block `app.register(async (protectedApp) => { protectedApp.addHook("preHandler", createAuthHook(requiredToken)); })` to ensure authentication is enforced. Ensure tests verify both the authenticated and unauthenticated access for such endpoints.
