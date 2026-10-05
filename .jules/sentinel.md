## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-02-14 - Timing attacks when comparing secrets

**Vulnerability:** API tokens and secrets were being checked with standard JavaScript equality (=== or !==) operators. This is vulnerable to timing attacks as character-by-character string comparisons return early upon the first mismatch.
**Learning:** These small timing differences could be used by an attacker to guess a secret string one character at a time by making many requests and analyzing the time to response.
**Prevention:** Use `node:crypto`'s `timingSafeEqual()` function (padding the inputs with hashes of the values so it always processes a constant size and won't crash on length mismatches) when verifying any secure tokens.
