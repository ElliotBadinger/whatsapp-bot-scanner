## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-12-21 - CSRF Token Mismatch in Scaled Environments

**Vulnerability:** The application was vulnerable to CSRF token mismatches and lack of deterministic validation when multiple instances were deployed. If a new node was spun up, its dynamically generated CSRF token would not match the ones expected from existing configurations, breaking authenticated commands.
**Learning:** In horizontally scaled applications (like Control Plane and WhatsApp Client running simultaneously), fallback security tokens such as CSRF tokens should never be derived unpredictably. Relying purely on environment variables without a deterministic fallback causes state inconsistencies.
**Prevention:** Implement deterministic token derivation by hashing a master shared secret (like the API token) using a secure hashing algorithm (SHA-256) when an explicit configuration isn't provided.
