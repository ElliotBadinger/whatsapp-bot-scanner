## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.
## 2025-01-16 - Code Execution Vulnerability via eval()

**Vulnerability:** Use of `eval("require")` in `packages/shared/src/database.ts` introduces a potential risk of arbitrary code execution.
**Learning:** `eval` is generally discouraged because it can execute arbitrary JavaScript. While in this context it was used to bypass bundler static analysis for an optional dependency, it still triggers security scanners and is fundamentally insecure.
**Prevention:** Use standard Node.js module loading mechanisms like `createRequire` to dynamically resolve modules instead of using `eval()`.
