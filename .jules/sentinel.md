## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-12-23 - CSRF Token Defaults to Authentication Token

**Vulnerability:** The CSRF token in the control plane configuration defaulted to the authentication token (`CONTROL_PLANE_API_TOKEN`) if not explicitly set. This defeats the purpose of CSRF protection since the tokens are identical.
**Learning:** Security tokens should never default to other secrets. Reusing authentication tokens for CSRF protection provides no defense against CSRF attacks, as the attacker would just need to steal one token to bypass both layers.
**Prevention:** Always generate independent CSRF tokens. If deriving from an existing secret is required (e.g., in a stateless horizontally scaled environment), use deterministic cryptographic hashing with a salt (e.g., `crypto.createHash('sha256').update(token).update(salt).digest('hex')`) instead of returning the plaintext secret.
