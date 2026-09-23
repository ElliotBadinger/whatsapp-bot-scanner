## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-12-21 - Timing Attack in Authentication Hook

**Vulnerability:** The `createAuthHook` function in the control plane used a simple string comparison (`token !== expectedToken`) to verify the authentication token. This allows attackers to perform a timing attack to guess the secret token character by character.
**Learning:** V8 engine optimizes string comparisons by comparing lengths first, then characters one by one and exiting on the first mismatch. This predictable timing variation leaks information. Furthermore, simply checking length before using `crypto.timingSafeEqual` also leaks the expected length.
**Prevention:** Always use `crypto.timingSafeEqual` for comparing secrets. To avoid leaking length information, hash both the expected and provided secrets using a strong cryptographic hash (e.g., SHA-256) before passing them to `timingSafeEqual`.
