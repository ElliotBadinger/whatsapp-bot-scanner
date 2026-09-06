## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2024-05-26 - Timing Attack Vulnerability in Secret Comparison

**Vulnerability:** The scan orchestrator service compared the URLScan callback secret directly using standard string equality (`!==`). This exposed the callback endpoint to timing attacks, allowing attackers to incrementally guess the secret token by observing minute differences in response times. (AUTH-002)
**Learning:** Standard string equality operations exit as soon as a mismatch is found, taking more or less time depending on the length of the matched prefix. Security tokens must always be compared in constant time.
**Prevention:** Always use constant-time comparison functions like `crypto.timingSafeEqual` for comparing secrets, API keys, and auth tokens. Convert strings to Buffers and check length equality before applying the comparison.
