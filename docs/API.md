# Control Plane API (v0)

Auth: `Authorization: Bearer <CONTROL_PLANE_API_TOKEN>`

CSRF: Include `X-CSRF-Token: <CONTROL_PLANE_CSRF_TOKEN>` on every state-changing request (`POST` routes). Requests missing the
token or originating from a disallowed origin are rejected with HTTP 403.

> The control-plane service aborts startup when `CONTROL_PLANE_API_TOKEN` is unset or blank—configure this to a strong secret before running.

- GET `/healthz` → `{ ok: true }`
- GET `/status` → `{ scans: number, malicious: number }`
- GET `/overrides` → `Override[]`
- POST `/overrides` → body: `{ url_hash?, pattern?, status: 'allow'|'deny', scope: 'global'|'group', scope_id?, reason?, expires_at? }`
- POST `/groups/:chatId/mute` → `{ ok: true, muted_until }`
- POST `/groups/:chatId/unmute` → `{ ok: true }`
- POST `/rescan` → `{ ok: true, urlHash: string, jobId: string }`; the service rejects internal or invalid targets with `400`
- GET `/scans/:urlHash/urlscan-artifacts/:type` → binary response for persisted artifacts (`type`: `screenshot` or `dom`) served
  with download headers and strict CSP to prevent inline execution

Metrics: `/metrics` (Prometheus format)

## Override precedence

- `url_hash` overrides win over pattern-based entries, even if the pattern was created later. Use these for one-off false
  positives/negatives when you can copy the canonical hash from `/scans`.
- Pattern overrides match against the normalized hostname. Provide exact domains (`example.com`), glob wildcards (`*.example.com`),
  or SQL-style wildcards (`%.example.com`) to cover subdomains.
- Expired overrides are ignored; otherwise the most recent matching pattern takes effect.
- Manual `deny` verdicts force a block and manual `allow` suppresses all automated signals. The override reason is attached to the
  cached verdict payload so analysts can see why a score was changed.
