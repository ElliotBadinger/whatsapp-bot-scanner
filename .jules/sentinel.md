## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2024-03-22 - [Medium] Fix Public Metrics Endpoint Exposure

**Vulnerability:** The Prometheus `/metrics` endpoint in `control-plane` was registered as a public route (before the `createAuthHook`), exposing internal system state, queues, and potential memory layout information to unauthenticated users on the internet (INFO-004 / CWE-200).
**Learning:** Routes registered directly on the parent `Fastify` instance will not be affected by `app.register()` plugin hooks like preHandler authentication. Even internal-facing administrative endpoints must be explicitly placed behind authentication to prevent information disclosure.
**Prevention:** Register all administrative endpoints inside the protected plugin context where the `preHandler` hook enforcing `createAuthHook` is applied.
