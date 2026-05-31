## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-12-21 - Stateless CSRF Token Derivation

**Vulnerability:** The CSRF token was defaulting to the raw API token, effectively defeating CSRF protections by exposing the authentication credential. Re-using authentication credentials for CSRF bypasses the purpose of having a separate token.
**Learning:** In a horizontally scaled environment (like a Node.js API with multiple container instances), you cannot simply generate a random CSRF token on startup (e.g., using `crypto.randomBytes()`). Doing so creates a stateful token that differs per instance, causing valid requests to be rejected depending on which instance handles them.
**Prevention:** Always derive CSRF tokens deterministically from a master secret (like an API token) using an HMAC (e.g., `crypto.createHmac('sha256', apiToken).update('csrf').digest('hex')`) if a separate configuration value isn't provided. This ensures horizontal scaling without persisting state, while securely separating the auth token from the CSRF token.
