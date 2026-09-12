## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-12-08 - [Non-Constant-Time Token Comparison Fix]
**Vulnerability:** The control plane's authentication hook used strict equality (\`===\`) to compare the provided bearer token against the expected token.
**Learning:** Using simple string comparison for authentication tokens opens the application up to timing attacks, where attackers can guess tokens by measuring response times.
**Prevention:** Always use \`crypto.timingSafeEqual()\` with buffered strings when comparing sensitive security tokens or secrets.
