## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2024-12-23 - Deterministic CSRF Token Generation
**Vulnerability:** The CSRF token was effectively identical to the API token (AUTH-004), defeating the purpose of CSRF protection by linking security directly to the API token rather than establishing a separate layer.
**Learning:** While generating CSRF tokens with `crypto.randomBytes()` is standard, in horizontally scaled deployments (like edge functions or ephemeral containers) without shared state, runtime-randomized tokens result in immediate CSRF mismatch failures for client requests hitting different nodes.
**Prevention:** Instead of stateful randomness or using plain API tokens, derive CSRF tokens deterministically from existing secrets (e.g., `crypto.createHash('sha256').update(apiToken + 'salt').digest('hex')`). This ensures all nodes consistently generate the same token, enabling stateless, load-balanced validation without exposing the root token.
