## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.
## 2025-02-14 - Timing Attack Vulnerability in HMAC Verification

**Vulnerability:** The `verifyMac` function in `secureEnvelope.ts` used `timingSafeEqual` but preceded it with a length check: `expected.length !== provided.length`. If lengths mismatched, it threw an error immediately, bypassing `timingSafeEqual`. This allows an attacker to discover the correct length of the HMAC by observing timing differences.
**Learning:** `timingSafeEqual` throws an error if buffer lengths mismatch. A naive length check before `timingSafeEqual` leaks the expected length via timing.
**Prevention:** To securely handle variable lengths without leaking information, hash both the expected and provided values (e.g., using `crypto.createHash('sha256')`) and then compare the resulting fixed-length hashes using `timingSafeEqual`.
