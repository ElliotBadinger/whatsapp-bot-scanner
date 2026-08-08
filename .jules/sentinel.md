## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-12-23 - Metrics Endpoint Publicly Accessible (INFO-004)
**Vulnerability:** The `/metrics` endpoint on the control plane was registered before the authentication hook in fastify, making it publicly accessible over the network. This exposes internal system state, queue depths, and error rates via Prometheus metrics which could assist in reconnaissance or DoS attacks.
**Learning:** In fastify, route registration order dictates which hooks run. All routes declared before a `preHandler` hook is added are completely immune to it.
**Prevention:** Always register administrative endpoints (like `/metrics`, `/debug`, or `/config`) inside the block where the global authorization hook applies, unless a dedicated separate private port is explicitly configured for them.
