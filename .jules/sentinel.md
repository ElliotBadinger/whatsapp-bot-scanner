## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2023-10-24 - Timing Attacks on API Token Comparison
**Vulnerability:** The API token verification in `services/control-plane/src/index.ts` was using a standard string comparison (`===` or `!==`) to validate the `Bearer` token. This is vulnerable to timing attacks, where an attacker could deduce the token by measuring the time it takes for the server to reject incorrect tokens character by character.
**Learning:** String comparisons in JavaScript fail early as soon as a character mismatch is found. For secrets like API tokens, passwords, or signatures, this leaks information about the length and contents of the secret.
**Prevention:** Always use `crypto.timingSafeEqual()` when comparing sensitive strings. Remember to first convert the strings to buffers of equal length, as `timingSafeEqual` will throw an error if the lengths do not match.
