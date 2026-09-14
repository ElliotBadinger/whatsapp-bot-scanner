## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2024-05-18 - [Fix Token Timing Attack]
**Vulnerability:** The `createAuthHook` in `services/control-plane/src/index.ts` uses strict equality (`===`) to compare the provided bearer token with the expected control plane token. This allows attackers to perform a timing attack, potentially brute-forcing the token character by character by measuring the response times.
**Learning:** Hardcoded comparisons or simple `===` on secret values (like authentication tokens or HMACs) leak timing information, bypassing the purpose of using strong secret keys.
**Prevention:** Always use `crypto.timingSafeEqual()` from Node's built-in `crypto` module when comparing secrets, after first ensuring they are converted to equal-length Buffers.
