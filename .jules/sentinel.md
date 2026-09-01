## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-02-18 - Timing Attack Vulnerability in Authentication

**Vulnerability:** The API token verification used a standard string equality check (`token !== expectedToken`), making it vulnerable to timing attacks where attackers could guess the token character by character.
**Learning:** Standard string comparisons abort at the first differing character, leaking the position of the mismatch through response time.
**Prevention:** Always use `crypto.timingSafeEqual` for comparing secrets like API tokens, passwords, or HMACs. Ensure the buffers being compared have the exact same length before calling `timingSafeEqual` to avoid throwing errors.
