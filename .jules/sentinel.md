## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-02-23 - Protect /metrics Endpoint from Unauthorized Access
**Vulnerability:** The `/metrics` endpoint in the `control-plane` service was registered as a public route without authentication, leading to potential information disclosure of sensitive internal system metrics (INFO-004).
**Learning:** Fastify routes registered on the global `app` object before `app.register` blocks with `preHandler` hooks are not protected by those hooks. It's crucial to ensure that endpoints exposing internal system state are explicitly included inside authenticated blocks.
**Prevention:** Always ensure sensitive operational or monitoring routes are wrapped in an `app.register` block containing the appropriate authentication hook (`preHandler: createAuthHook(...)`) or protected by a separate internal-only port binding.
