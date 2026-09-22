## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2024-12-24 - Timing Attack in API Token Comparison

**Vulnerability:** The API token comparison in `services/control-plane/src/index.ts` used simple string equality (`token !== expectedToken`). This allows an attacker to perform a timing attack to recover the token character-by-character.
**Learning:** Standard string comparisons in JavaScript exit early on the first mismatched character, creating a measurable timing difference. For secrets (like API tokens, passwords, or signatures), this execution time variability leaks the secret.
**Prevention:** Always use `crypto.timingSafeEqual` for secret comparisons. To prevent timing differences due to input length and avoid errors when comparing buffers of different lengths, hash both the expected secret and user input before comparison.
