## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-04-02 - Timing Attack Vulnerability in Token Comparison

**Vulnerability:** The URLScan callback handler compared token secrets using standard strict inequality (`!==`), which is susceptible to timing attacks. This could allow an attacker to guess the expected secret character-by-character based on evaluation time.
**Learning:** Native `crypto.timingSafeEqual` prevents timing attacks, but it strictly requires both inputs to be buffers of the exact same length and throws an error if they are not. An attacker could exploit this by providing strings of different lengths to cause unhandled exceptions and potentially denial of service.
**Prevention:** To safely compare strings of unknown lengths in a constant-time manner, first hash both inputs (e.g., using `crypto.createHash("sha256")`). Since the resulting hashes will always have the identical length (e.g., 32 bytes for SHA-256), they can be safely compared using `crypto.timingSafeEqual` without throwing exceptions, preventing both timing attacks and length-leaking.
