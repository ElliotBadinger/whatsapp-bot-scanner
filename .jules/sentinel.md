## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2026-09-20 - [Derive CSRF token from API Token securely]

**Vulnerability:** CSRF token fell back to the exact API token in plaintext.
**Learning:** Returning a raw API token as the fallback for CSRF tokens allows attackers to potentially intercept the CSRF token and abuse the API token.
**Prevention:** In environments where multiple tokens are required, always securely derive tokens from base secrets (e.g., using HMAC or SHA-256 with salts) to prevent lateral token leakage.
