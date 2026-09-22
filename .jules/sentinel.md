## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-12-08 - Fixed CSRF Token Defaulting to API Token

**Vulnerability:** The CSRF token was defaulting to the exact same value as the API token if explicitly unconfigured. Since the API token grants high-level privileges, exposing it in any form designed for the CSRF token (such as client headers) could leak the core authentication secret.
**Learning:** Hashing the API token provides a quick and cryptographically secure mechanism to derive a unique token that acts independently of the main API token (defense-in-depth), preventing a single-point-of-failure compromise for API token exposure.
**Prevention:** Avoid assigning high-privilege configuration defaults to security mechanisms like CSRF. Either fail fast on start up (i.e. require the variable to be set) or deterministically derive a lesser-privileged value.
