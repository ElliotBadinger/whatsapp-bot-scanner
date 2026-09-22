## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-02-20 - Timing Attack in Authentication Hook Fixed

**Vulnerability:** The `createAuthHook` function in the control plane used strict equality (`===`) to compare the API token from the request with the expected token. This creates a vulnerability to timing attacks, where an attacker could measure response times to guess the token character by character.
**Learning:** Hardcoded comparisons like `if (token === expectedToken)` are vulnerable in sensitive authentication paths. Node.js built-in `crypto.timingSafeEqual` should be used. However, it requires inputs of the same length. Therefore, hashing both the expected token and the provided token and then comparing the fixed-length hashes is a robust way to avoid both timing attacks and length-mismatch errors.
**Prevention:** Always use `crypto.timingSafeEqual(hash1, hash2)` when comparing sensitive authentication tokens, API keys, or passwords instead of standard equality operators.
