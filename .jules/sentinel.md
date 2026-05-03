## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-02-21 - Timing Attack Vulnerability in Token Comparison

**Vulnerability:** The authentication token in the `createAuthHook` in `services/control-plane/src/index.ts` was compared using the standard strict inequality operator (`!==`). This allows for a timing attack because the string comparison short-circuits at the first mismatch, leaking information about the token character by character.
**Learning:** Using standard equality checks for security tokens or secrets introduces timing side channels that can be exploited for brute-forcing over the network. Furthermore, using `crypto.timingSafeEqual` directly on strings or differently sized buffers leads to an application crash.
**Prevention:** Always convert strings to buffers (`Buffer.from(string)`) and explicitly check for matching lengths (`buffer1.length === buffer2.length`) before using a constant-time comparison function like `crypto.timingSafeEqual` to avoid both timing attacks and potential Denial of Service (crash) scenarios.
