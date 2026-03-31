## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## $(date +%Y-%m-%d) - [🛡️ Sentinel: Fix Timing Attack in URLScan Callback Handler]
**Vulnerability:** The URLScan callback handler compared the `headerToken` and `queryToken` with the `secret` using the `!==` operator, which is vulnerable to timing attacks. An attacker could potentially infer the secret by analyzing the response time of the API.
**Learning:** String comparisons of sensitive tokens or secrets must use a timing-safe method like `crypto.timingSafeEqual()`. However, `timingSafeEqual()` throws an error if the strings are of different lengths.
**Prevention:** Always hash the input strings (e.g., using `crypto.createHash('sha256')`) before comparing them with `crypto.timingSafeEqual()`. This ensures the comparison is securely performed regardless of the input length and prevents length-based errors or length-leakage.
