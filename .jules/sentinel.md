## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2026-09-25 - [Timing Attack in Token Validation]

**Vulnerability:** The control plane `createAuthHook` compared secret tokens using simple string equality (`!==`), making it susceptible to timing side-channels that leak token characters.
**Learning:** String comparisons short-circuit. Comparing variable length strings securely requires either padding or hashing both inputs before using `crypto.timingSafeEqual()`, to prevent length leakage throwing errors.
**Prevention:** Always use `crypto.timingSafeEqual` to compare secrets. Ensure inputs to `timingSafeEqual` are the exact same length (e.g. by comparing hashes of the inputs) so that it doesn't leak the expected length via thrown errors.
