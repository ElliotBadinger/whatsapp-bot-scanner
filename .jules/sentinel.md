## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2024-05-23 - Hardcoded Secrets in K8s Manifests

**Vulnerability:** Found a hardcoded Bearer token (`0c631281be532906ba6af324a5ea626aec3de294bd3eb71aa0b2872942344fb7`) in the `livenessProbe` command of `k8s/control-plane-deployment.yaml`.
**Learning:** Kubernetes `exec` probes do not automatically expand environment variables in the command string unless run inside a shell. Developers might hardcode secrets to make the command work quickly, or tools like `kompose` might inline values.
**Prevention:** Always use `/bin/sh -c` for `exec` probes that require environment variables, or use a script (e.g., `node -e`) that accesses `process.env` directly. Never hardcode secrets in deployment manifests.
