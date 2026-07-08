## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2024-07-08 - Fixed Timing Attack in Authentication Hook

**Vulnerability:** The `createAuthHook` function in `control-plane/src/index.ts` used strict equality (`===`) to compare the provided bearer token with the expected token. This creates a timing attack vulnerability where an attacker can determine the token character by character based on string comparison time.
**Learning:** Even internal service-to-service authentication mechanisms must be protected against timing attacks, especially when strict equality is used for comparing variable length secrets.
**Prevention:** Use `crypto.timingSafeEqual()` for all secret comparisons. Ensure compared strings are hashed or converted to buffers of equal length beforehand, since `timingSafeEqual` throws an error if buffer lengths do not match.
