## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2024-05-27 - [Fix timing attack vulnerability in token verification]
**Vulnerability:** A simple string comparison (`token !== expectedToken`) was used in `createAuthHook` for validating bearer tokens in the control-plane service. This can allow an attacker to progressively guess the token characters using timing attacks.
**Learning:** Hardcoded tokens or secret strings should not be compared using standard equality operators (`==`, `!=`, `===`, `!==`) as they "short-circuit" upon the first differing character, leaking the length of the matched prefix via processing time differences.
**Prevention:** Always use a constant-time comparison function, like `crypto.timingSafeEqual` in Node.js, to validate secrets. Ensure proper handling of inputs, as `timingSafeEqual` will throw an error if the buffers are of different lengths (which itself can leak the expected length if not handled by a dummy comparison).
