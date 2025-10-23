# Control Plane API (v0)

Auth: `Authorization: Bearer <CONTROL_PLANE_API_TOKEN>`

- GET `/healthz` → `{ ok: true }`
- GET `/status` → `{ scans: number, malicious: number }`
- GET `/overrides` → `Override[]`
- POST `/overrides` → body: `{ url_hash?, pattern?, status: 'allow'|'deny', scope: 'global'|'group', scope_id?, reason?, expires_at? }`
- POST `/groups/:chatId/mute` → `{ ok: true, muted_until }`
- POST `/groups/:chatId/unmute` → `{ ok: true }`
- POST `/rescan` → `{ ok: true }`
- GET `/scans/:urlHash/urlscan-artifacts/:type` → binary response for persisted artifacts (`type`: `screenshot` or `dom`)

Metrics: `/metrics` (Prometheus format)
