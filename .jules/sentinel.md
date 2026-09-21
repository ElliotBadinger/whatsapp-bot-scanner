## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## $(date +%Y-%m-%d) - Timing Safe String Comparison

**Vulnerability:** Comparing sensitive strings (like auth tokens) using `!==` or `===` allows timing attacks. Attackers can guess the token by measuring how long the comparison takes.
**Learning:** Checking string length or returning early when length differs leaks information about the secret's expected length.
**Prevention:** Hash both strings to a constant length first, then use `crypto.timingSafeEqual()` on the hashes to perform the comparison securely.
