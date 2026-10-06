## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2026-10-06 - [INFO-004] Secure Metrics Endpoint in Control Plane
**Vulnerability:** The `/metrics` endpoint was registered outside the Fastify auth hook (`app.get`), making internal Prometheus metrics (system state, queue depths, error rates) publicly accessible without authentication.
**Learning:** In Fastify, routes registered directly on the main `app` instance before a hook or an encapsulated `app.register` block will bypass that authentication hook. Order of registration and structural encapsulation matter critically for security.
**Prevention:** Register sensitive endpoints (like `/metrics`) inside the authenticated `protectedApp` scope created by `app.register`, ensuring they are protected by the `preHandler` auth hook.
