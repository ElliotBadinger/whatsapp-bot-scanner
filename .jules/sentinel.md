## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-06-07 - [AUTH-001/AUTH-002] Fixed timing attack vulnerability in auth hook

**Vulnerability:** The `createAuthHook` in `services/control-plane/src/index.ts` was using a standard equality check (`token !== expectedToken`) to compare authentication tokens.
**Learning:** Standard string comparison operators return false as soon as they encounter a character mismatch, allowing attackers to incrementally guess secret tokens by measuring the time the comparison takes (timing attack).
**Prevention:** Always convert strings to `Buffer` objects and use `crypto.timingSafeEqual` for all secret comparisons to ensure they take a constant amount of time regardless of input validity. Ensure both buffers are the same length before comparison to avoid runtime errors.
