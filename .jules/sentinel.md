## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-12-21 - CSRF Token Reuse Vulnerability

**Vulnerability:** The CSRF token (`config.controlPlane.csrfToken`) defaulted to reusing the authentication API token (`process.env.CONTROL_PLANE_API_TOKEN`). This defeats the purpose of CSRF protection since an attacker who captures the CSRF token now has the API token, or the CSRF protection is ineffective as it isn't a separate secret.
**Learning:** Never reuse authentication tokens for CSRF protection. CSRF tokens should be derived independently or explicitly set as a separate secret. If deriving from an existing secret, it must be cryptographically hashed (e.g., SHA-256 with a salt) so the original secret cannot be reversed.
**Prevention:** Use a standard, distinct secret for CSRF protection. When a fallback is needed, deterministically derive it using a one-way hash like `crypto.createHash('sha256').update(apiToken).update('csrf-salt').digest('hex')` rather than plaintext fallback, avoiding stateful random bytes during module load to ensure horizontal scaling works correctly.
