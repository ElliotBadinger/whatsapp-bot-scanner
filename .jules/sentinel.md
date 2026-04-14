## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-12-23 - Prevent Timing Attack in Token Validation
**Vulnerability:** Fastify route authorization checked `token !== expectedToken` via strict string equality, exposing the length and exact characters of the token via timing attacks due to early short-circuiting in standard string comparison.
**Learning:** Checking secure tokens via standard string comparison allows a remote attacker to iterate through characters over time and brute force the token. Moreover, Node.js `crypto.timingSafeEqual` will explicitly throw if the target buffers differ in length.
**Prevention:** Use `crypto.timingSafeEqual` for sensitive string validations. Preemptively check if the lengths of both inputs differ and manually reject early to avoid the native module throwing a Fatal `TypeError`. Encode tokens to Buffers (`Buffer.from(token, "utf8")`) before the comparison.
