## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-08-09 - CSRF Token Defaults to API Token

**Vulnerability:** The CSRF token was defaulting to the plaintext authentication token, completely defeating the purpose of CSRF protection by allowing identical tokens for both.
**Learning:** When implementing CSRF protection in a distributed, horizontally scaled environment where a master API token is the root of trust, you cannot safely fall back to reusing the token directly. Relying on stateful generated tokens on module load fails across instances.
**Prevention:** Ensure CSRF tokens are cryptographically distinct from auth tokens. Derive deterministic CSRF tokens using `crypto.createHash("sha256")` with the root secret and a salt to enable stateless, multi-instance CSRF validation.
