## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-12-23 - Deterministic Fallback Token Derivation

**Vulnerability:** The CSRF token fallback logic returned the authentication token in plaintext, defeating the purpose of CSRF protection by exposing the very secret it was meant to isolate.
**Learning:** Using `crypto.randomBytes()` for fallback token generation in a distributed or horizontally scaled environment leads to token mismatch across instances, causing authentication/authorization failures for legitimate users.
**Prevention:** Always use deterministic derivation (e.g., hashing a master secret with a salt) or persistent shared storage when generating fallback security tokens across multiple instances to ensure consistency.
