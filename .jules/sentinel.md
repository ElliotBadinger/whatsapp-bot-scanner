## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2024-06-26 - [AUTH-004] Fix CSRF Token Reusing API Token
**Vulnerability:** The CSRF token was defaulting to the API token in `packages/shared/src/config.ts`, violating the principle of distinct tokens for distinct purposes.
**Learning:** Hardcoding token reuse in configs defeats CSRF protection. In multi-instance or scaled environments, fallback tokens must be generated deterministically (e.g., via hashing) to avoid token mismatch across instances when stateful tokens (like `crypto.randomBytes()`) are used.
**Prevention:** Always derive fallback security tokens deterministically from a master secret, and ensure they are computationally distinct from the master secret itself.
