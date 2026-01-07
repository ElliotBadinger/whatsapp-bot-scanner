## 2025-10-27 - Rate Limiting Missing on Control Plane API

**Vulnerability:** The control plane API (`services/control-plane`) lacked rate limiting on authenticated endpoints. While authentication was present, authenticated users (or compromised tokens) could potentially DoS the service or brute-force resources.
**Learning:** Even internal or authenticated APIs need rate limiting to prevent resource exhaustion and abuse. Relying solely on authentication assumes trust that may be violated by compromised credentials or bugs in client logic.
**Prevention:** Implemented rate limiting middleware using `rate-limiter-flexible` (via shared utility) on all protected routes. Added `X-RateLimit` headers to response for client visibility.
