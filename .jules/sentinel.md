## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.
## 2024-12-19 - [Authentication Required for Metrics Endpoint]
**Vulnerability:** The /metrics endpoint in `services/control-plane` was registered before the authentication hook, making it publicly accessible and potentially revealing internal system state and metrics (CWE-200).
**Learning:** Public routes in Fastify are registered before an authenticated block using `app.register()`. Moving the route inside the protected block secures it.
**Prevention:** Always register sensitive or internal monitoring endpoints within the authenticated scope, explicitly using hooks like `createAuthHook`.
