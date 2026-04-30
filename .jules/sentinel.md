## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2026-04-30 - Timing Attack via Non-Constant Time Token Comparison

**Vulnerability:** The API token verification in `createAuthHook` (`services/control-plane/src/index.ts`) used `!==` which evaluates strings character by character and returns as soon as a mismatch occurs. This was susceptible to a timing attack where an attacker could theoretically guess the token based on response times.
**Learning:** In Javascript, basic operators such as `===` and `!==` operate in non-constant time, and therefore should never be used to compare secrets (like tokens, passwords, signatures) as they can be subjected to timing attacks to guess the secret value.
**Prevention:** Always use `crypto.timingSafeEqual()` for secret comparisons. Furthermore, `crypto.timingSafeEqual()` requires both arguments to have the exact same length, otherwise it throws an error. So you should hash the expected token and user-provided token (e.g., using `crypto.createHash('sha256')`) before passing them to `timingSafeEqual`, as hashing normalizes their lengths to be identical.
