## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2024-12-21 - AUTH-001: Timing Attack in Token Comparison

**Vulnerability:** Fastify `createAuthHook` compared strings using standard equality (`!==`), making it vulnerable to timing attacks where attackers can deduce valid tokens character by character.
**Learning:** Comparing tokens directly allows the runtime to short-circuit upon finding a mismatch, creating a measurable timing difference. Variable-length tokens add complexity.
**Prevention:** Always use `crypto.timingSafeEqual()` for secret comparisons. Since string lengths must match exactly before using `timingSafeEqual`, hashing both inputs first with `crypto.createHash('sha256')` is a robust way to handle variable lengths securely.
