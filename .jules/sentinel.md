## 2024-03-29 - Missing Rate Limiting on Control Plane Endpoints

**Vulnerability:** The control plane endpoints (e.g., `/rescan`, `/overrides`, and general `/scans`) lacked any rate limiting, making them vulnerable to brute force and Denial of Service (DoS) attacks.
**Learning:** Shared rate limiting utility (`createApiRateLimiter` from `@wbscanner/shared`) existed but wasn't wired into the fastify app, likely skipped during initial implementation. Also, initializing rate limiters in testing requires explicit configuration (`rateLimitOptions: { forceMemory: true }`) to bypass Redis script execution requirements and connection errors.
**Prevention:** Ensure new exposed endpoints, particularly POST routes handling resource intensive tasks or configurations, explicitly include rate limit pre-handlers in Fastify routers.
