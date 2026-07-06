## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.
## 2025-02-23 - Hardcoded Fallback Tokens Vulnerability

**Vulnerability:** The application used `getControlPlaneToken()` directly as a fallback for the `CONTROL_PLANE_CSRF_TOKEN`. If an attacker obtained the CSRF token (which is sometimes exposed or easier to guess), they would inadvertently obtain the highly sensitive API authentication token, defeating the purpose of separating credentials.
**Learning:** Fallback mechanisms for security tokens must never directly expose or reuse primary authentication secrets. When a fallback is necessary in a horizontally scaled environment, it must be generated deterministically (e.g., hashing a master secret) rather than randomly on module load, to ensure token consistency across all instances without requiring shared persistent storage.
**Prevention:** Use a cryptographic hash function (like SHA-256) to derive secondary tokens from primary secrets when dedicated configuration is missing. This ensures the derived token is deterministic across instances but non-reversible to the primary secret. Always verify that mock configurations in test files match these updated derivation logic patterns to prevent test suite regressions.
