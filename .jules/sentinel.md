## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.
## 2025-12-21 - CSRF Token Fallback Vulnerability

**Vulnerability:** The application fell back to using the plaintext API authentication token as the CSRF token if an explicit CSRF token was not provided in the environment variables. This creates a risk where leakage of the CSRF token (which may be exposed in headers or frontend state) would inadvertently leak the highly sensitive API authentication token, defeating CSRF protection and compromising the API.
**Learning:** Never reuse an authentication token for a CSRF token or any other security mechanism that has a different exposure profile.
**Prevention:** If a distinct token isn't provided, derive a fallback token deterministically using a one-way cryptographic hash (e.g., `crypto.createHash('sha256')`) of the authentication token combined with a unique salt. This ensures the fallback token is stable but cannot be reversed to discover the authentication token.
