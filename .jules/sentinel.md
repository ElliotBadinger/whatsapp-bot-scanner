## 2025-12-21 - SSRF Bypass via IPv4-Mapped IPv6 Addresses

**Vulnerability:** The `isPrivateIp` function failed to detect IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) as private. This allowed SSRF bypass where an attacker could access internal services by using the IPv6 representation of private IPv4 addresses.
**Learning:** Network libraries often treat IPv4-mapped IPv6 addresses as IPv6, but they effectively route to IPv4 destinations. Simply checking IPv4 ranges against an IPv6 address object fails.
**Prevention:** Always convert IPv4-mapped IPv6 addresses to their IPv4 equivalent before checking against allow/deny lists. Use `addr.isIPv4MappedAddress()` and `addr.toIPv4Address()` provided by libraries like `ipaddr.js`.

## 2025-12-21 - CSRF Token Generation Issue Fixed

**Vulnerability:** The application derived its CSRF token using an `||` operator fallback with the API token instead of hashing it with a salt. This meant that if `CONTROL_PLANE_CSRF_TOKEN` was not provided, the API token could be derived, compromising CSRF protections.
**Learning:** Hardcoded derivations that rely entirely on the absence of environment variables provide poor isolation. CSRF tokens should be derived deterministically with salts for better entropy and isolation, or generated randomly using `node:crypto`.
**Prevention:** Make sure authentication token values are not repurposed directly for CSRF tokens without applying cryptographic transformations using salts or hashes (e.g. `crypto.createHash('sha256').update(token + "salt").digest("hex")`). Always verify the changes with related unit tests that validate CSRF mechanisms.
