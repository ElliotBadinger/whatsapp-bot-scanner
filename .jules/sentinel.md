## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2024-05-30 - Prevent Timing Attacks in Token Verification

**Vulnerability:** Simple string comparison (`!==`) was used to compare the provided authentication token with the expected API token in `services/control-plane/src/index.ts`.
**Learning:** String comparison fails as soon as a mismatch is found, allowing an attacker to deduce the token character by character based on the time it takes for the server to reject the request.
**Prevention:** Use `crypto.timingSafeEqual()` for comparing secrets. Because `timingSafeEqual()` throws an error if the lengths of the two buffers don't match, always compare their lengths (`expectedBuf.length !== providedBuf.length`) before calling the function.
