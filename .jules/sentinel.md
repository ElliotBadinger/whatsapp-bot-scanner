## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-02-23 - Hardcoded CSRF token derivation vulnerability

**Vulnerability:** The CSRF token was defaulting to the same value as the API authentication token, defeating the purpose of CSRF protection since an attacker who obtains the CSRF token effectively has the API token.
**Learning:** Reusing authentication tokens as CSRF tokens is an anti-pattern that can lead to credential leakage.
**Prevention:** Derive a separate CSRF token by hashing the API token with a salt.
