## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-12-21 - SSRF Mitigation: DNS Rebinding Protection via IP Pinning

**Vulnerability:** The `isPrivateHostname` check followed by a separate HTTP request allowed for Time-of-Check to Time-of-Use (TOCTOU) race conditions, specifically DNS Rebinding. An attacker could resolve a domain to a public IP during the check and a private IP during the request.
**Learning:** `undici` requests re-resolve hostnames by default. To pin the IP, we must resolve it first, then construct the URL with the IP while preserving the original `Host` header and `servername` (SNI) to support virtual hosting and TLS.
**Prevention:** Use `resolveSafeIp` to get a validated IP, then use `request(urlWithIp, { servername: originalHost, headers: { host: originalHost } })`.
