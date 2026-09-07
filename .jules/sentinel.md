## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2024-05-23 - Hardcoded Secrets in ConfigMap and Liveness Probes

**Vulnerability:** Found high-entropy secrets (API keys, JWT secrets) stored in plain text in a Kubernetes ConfigMap and hardcoded in a Deployment's liveness probe command.
**Learning:** ConfigMaps are often treated as less sensitive than Secrets, but they are still accessible. Also, `exec` probes in Kubernetes manifests do not automatically expand environment variables in the command string unless run within a shell.
**Prevention:** Always use Kubernetes Secrets for sensitive data. When using secrets in liveness/readiness probes, wrap the command in `/bin/sh -c` to access environment variables populated from the Secret.
