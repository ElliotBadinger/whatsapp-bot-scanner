## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-12-21 - Insecure CSRF Token Default

**Vulnerability:** The CSRF token was defaulting to the exact same value as the authentication token (`CONTROL_PLANE_API_TOKEN`). This defeated the purpose of CSRF protection since an attacker exploiting CSRF could just use the known or predictable authentication token as the CSRF token.
**Learning:** Using the same secret for both authentication and CSRF protection provides no defense against CSRF attacks. CSRF tokens must be distinct from authentication credentials.
**Prevention:** Always derive CSRF tokens deterministically from a strong secret using a cryptographic hash (e.g., SHA-256 with a salt) or generate a separate random token. Never reuse authentication tokens directly for CSRF protection.
