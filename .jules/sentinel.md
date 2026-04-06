## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-12-21 - Timing Attacks via Direct String Comparison of Secrets
**Vulnerability:** Authentication tokens were compared using strict equality (`!==`) instead of timing-safe functions. This exposes the application to timing attacks, where an attacker can infer the correct token character-by-character by measuring the time it takes for the application to reject an incorrect token.
**Learning:** Node.js's built-in strict string comparison returns early on the first mismatching character. When dealing with authentication tokens, webhooks secrets, or passwords, this creates measurable time discrepancies.
**Prevention:** Always use `crypto.timingSafeEqual()` for comparing secret values. Crucially, convert the strings to `Buffer`s first using `Buffer.from(secret, 'utf8')` and explicitly check for length equality (`buf1.length === buf2.length`) before calling the function, as `timingSafeEqual` will throw an exception if the lengths do not match.
