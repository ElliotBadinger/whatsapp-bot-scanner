## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-02-09 - Publicly Accessible Metrics Endpoint

**Vulnerability:** The `/metrics` endpoint in `services/control-plane/src/index.ts` was registered before the authentication hook, making it publicly accessible without a token.
**Learning:** Prometheus metrics can reveal internal system state, queue depths, error rates, and other sensitive operational data to unauthenticated attackers.
**Prevention:** Register sensitive operational endpoints like `/metrics` within authenticated route blocks alongside other protected APIs.
