## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-12-08 - Deterministic CSRF Token Fallback

**Vulnerability:** Reusing the API token as a CSRF token defeats CSRF protection (AUTH-004). Generating stateful random tokens on module load causes token mismatch across instances in horizontally scaled environments.
**Learning:** Fallback security tokens in scaled environments must be derived deterministically from a master secret (e.g., hashing the API token) or persisted in shared storage to ensure consistency.
**Prevention:** Use a deterministic derivation method like `crypto.createHash('sha256').update(masterSecret).update('salt').digest('hex')` for fallback tokens instead of reusing the plaintext secret or generating random values.
