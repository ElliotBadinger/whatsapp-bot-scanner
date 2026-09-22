## 2024-07-20 - CSRF Token Leaks API Key Fallback

**Vulnerability:** The CSRF token in the application's configuration `config.ts` defaulted to the `CONTROL_PLANE_API_TOKEN` if not explicitly set. This fallback logic leaked a highly privileged token, and its enforcement was largely ineffective since the endpoints were authenticated via Bearer tokens.
**Learning:** Fallback mechanisms shouldn't inadvertently downgrade security by exposing powerful secrets via secondary channels like CSRF headers.
**Prevention:** Always derivate secondary tokens (e.g., using `crypto.createHash('sha256').update(secret + "salt").digest('hex')`) rather than reusing primary authentication tokens directly. Additionally, use `crypto.timingSafeEqual` for string comparisons when authenticating via headers to mitigate timing attacks.
