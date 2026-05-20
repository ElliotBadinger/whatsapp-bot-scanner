## 2024-12-19 - Ensure public metrics endpoint is protected

**Vulnerability:** The `/metrics` endpoint in the control plane was publicly accessible, allowing unauthenticated users to read metrics data. This could leak sensitive system information like request rates, query performance, and memory usage.
**Learning:** Fastify allows adding routes before authentication hooks are defined, leaving those routes public. The `/metrics` route was registered globally before the `protectedApp` scope was evaluated.
**Prevention:** Always register routes that expose internal system state inside authenticated router scopes unless there is a specific need for them to be public. Avoid putting routes before `preHandler` hooks unless explicitly intended.
