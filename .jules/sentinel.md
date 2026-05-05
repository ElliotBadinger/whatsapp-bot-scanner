## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2024-05-05 - Fix CSRF token derivation fallback

**Vulnerability:** The default `CONTROL_PLANE_CSRF_TOKEN` was reusing the API token `CONTROL_PLANE_API_TOKEN` instead of creating a separate fallback token. Using the same token for both defeats the purpose of having a separate CSRF token, potentially exposing the CSRF defense to any attacker that learns the API token.
**Learning:** When generating a default CSRF token fallback (e.g. from an API token or a secret), never use `crypto.randomBytes()` as this causes issues in horizontally scaled environments. The tokens across different pods/instances would mismatch. Always derive a deterministic hash based on a shared secret (like the API token combined with a salt) so that multiple instances compute the same CSRF token.
**Prevention:** Use a deterministic hashing function (e.g. `crypto.createHash('sha256').update(secret + salt).digest('hex')`) instead of returning the API token unchanged or generating a completely random byte sequence.
