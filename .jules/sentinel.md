## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-12-21 - CSRF Token Fallback Derivation
**Vulnerability:** The CSRF token fallback logic reused the API authentication token directly, coupling authentication credentials with CSRF protection and risking token exposure during cross-origin requests.
**Learning:** Implementing fallback security tokens in horizontally scaled environments requires deterministic derivation (like hashing a master secret or base token) rather than generating stateful random bytes on module load, which causes token mismatches.
**Prevention:** Never use authentication credentials directly as CSRF tokens. Always generate or deterministically derive separate, single-purpose tokens using strong cryptographic hashing.
