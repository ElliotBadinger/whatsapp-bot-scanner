## 2024-05-24 - [Timing Attack in Token Comparison]

**Vulnerability:** The token comparison in `createAuthHook` in `services/control-plane/src/index.ts` was using the standard equality operator (`!==`), making it vulnerable to a timing attack where an attacker could measure response times to guess valid tokens character by character.
**Learning:** Even simple string comparisons for secrets (like authentication tokens) can introduce vulnerabilities if they exit early on mismatch.
**Prevention:** Always use `crypto.timingSafeEqual` when comparing secrets. Furthermore, because `timingSafeEqual` throws an error if the buffers are of different lengths, hash the strings first (e.g., using SHA-256) to ensure consistent lengths before comparison.
