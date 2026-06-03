## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2024-12-21 - Ineffective CSRF Token Default

**Vulnerability:** The CSRF token was defaulting to the same value as the API authentication token (`getControlPlaneToken()`). An attacker who obtains the CSRF token would also effectively have the API token.
**Learning:** Hardcoding or aliasing security tokens to other sensitive tokens breaks defense in depth. A token designed to protect against Cross-Site Request Forgery must not double as a bearer token for authentication.
**Prevention:** Generate CSRF tokens independently or deterministically derive them using an HMAC keyed with the API token (e.g., `crypto.createHmac('sha256', apiToken).update('csrf-token-derivation').digest('hex')`), ensuring the original token cannot be recovered.
