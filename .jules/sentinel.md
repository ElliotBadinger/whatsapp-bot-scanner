## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2023-10-24 - Non-Constant-Time Token Comparison

**Vulnerability:** A timing attack vulnerability was identified in `services/control-plane/src/index.ts` where string equality operator (`!==`) was used to compare authorization tokens.
**Learning:** Standard string comparison operators fail fast (as soon as a character mismatch is found), meaning the comparison time varies based on the length of the matching prefix. An attacker could use this time difference to perform character-by-character brute forcing of sensitive tokens.
**Prevention:** Always use `crypto.timingSafeEqual()` for secret comparison. Because `crypto.timingSafeEqual()` throws an error when inputs have different lengths, ensure to convert the strings to `Buffer`s and check that their `.length` are identical before comparison.
