## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2026-09-24 - Timing Attack Vulnerability in Auth Token Verification

**Vulnerability:** The `createAuthHook` function in the control plane compared authentication tokens using a simple string equality check (`token !== expectedToken`). This is susceptible to timing attacks, which could theoretically allow an attacker to guess the token byte-by-byte.
**Learning:** Using standard string comparison or even `crypto.timingSafeEqual()` directly on variable-length inputs can still leak length information.
**Prevention:** To prevent timing attacks when comparing string secrets, both inputs must first be securely hashed (e.g., using `crypto.createHash('sha256')`) to ensure they have the same fixed length, before comparing them using `crypto.timingSafeEqual()`.
