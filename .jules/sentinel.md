## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2026-08-18 - Fix Missing CSRF Token Derivation

**Vulnerability:** The `x-csrf-token` validation previously used the plaintext `CONTROL_PLANE_API_TOKEN` by default if a specific `CONTROL_PLANE_CSRF_TOKEN` was not provided. This meant the CSRF token was the same as the API token, largely defeating the purpose of separate CSRF protection.
**Learning:** Default configurations can inadvertently merge intended security controls (like separate CSRF tokens) into a single point of failure if fallback logic utilizes existing secrets directly without modification.
**Prevention:** If a fallback token must be derived from an existing secret, deterministically derive it using a cryptographic hash (e.g., HMAC or SHA-256 with a salt) rather than reusing the plaintext token. Always ensure separate validation paths don't collapse into checking the same plaintext secret.
