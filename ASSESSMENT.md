# Critical Assessment Report

## Architecture Gaps
- [ ] Missing: Secondary reputation providers (URLhaus, Phishtank) — Priority: HIGH — Reason: Current flow depends on single API per category, no fallback for quota or outage, violating strategy redundancy requirement.
- [ ] Missing: urlscan.io deep analysis pipeline — Priority: HIGH — Reason: Strategy mandates deep evidence capture for suspicious URLs to improve analyst context and detection accuracy.
- [ ] Missing: Shortener expansion pre-processing — Priority: HIGH — Reason: Without expansion we risk scanning transient domains and missing the true destination (strategy requires 100+ shortener coverage).
- [ ] Missing: Circuit breaker & retry orchestration — Priority: HIGH — Reason: All external calls are direct with no failure isolation, risking cascading latency and quota burn.
- [ ] Suboptimal: Risk scoring implementation — Current: 0-100 ad hoc weights, limited signals — Recommended: 0-15 weighted matrix with explicit thresholds — Impact: Inconsistent verdicts, hard to align with policy and caching tiers.
- [ ] Suboptimal: Caching strategy — Current: Binary positive/negative TTLs (3d/7d) — Recommended: Tiered TTL per verdict & per-provider cache keys — Impact: Over-caches malicious results, wastes quotas on benign.
- [ ] Missing: LLM explainability feature flag — Priority: MED — Reason: Strategy calls for optional operator summaries for high-risk findings.
- [ ] Missing: Multi-provider orchestration telemetry (latency, quota, circuit state) — Priority: MED — Reason: Observability specs require per-provider metrics to guide tuning.

## API Integration Status
| Category | Current Provider | Strategy Recommendation | Gap | Action Required |
|----------|------------------|-------------------------|-----|-----------------|
| Reputation Meta | VirusTotal v3 | VirusTotal v3 (Primary) + URLhaus (Secondary) | Missing secondary/fallback | Implement URLhaus lookup module with caching and failover wiring |
| Blocklist | Google Safe Browsing v4 | GSB v4 (Primary) + Phishtank (Secondary) | Missing secondary | Add Phishtank API client with timeout-based fallback path |
| URL Analysis | Custom resolver only | urlscan.io (Primary) + Custom (Secondary) | Missing urlscan.io | Integrate urlscan.io submission + callback worker, persist artifacts |
| Domain Intel | RDAP.org | WhoisXML (Primary when RDAP insufficient) + RDAP (Secondary) | Using only free RDAP | Add WhoisXML client, caching, and cost guardrails |
| Shortener | Not implemented | Unshorten.me (Primary) + URLExpander (Secondary) | Missing entirely | Detect shorteners & expand before scoring |
| Homoglyph | Basic punycode/xn-- check | confusable-homoglyphs library | Heuristic only | Upgrade detection and logging per strategy |
| LLM Explainability | Disabled | Gemini + Groq/Together (feature-flagged) | Not implemented | Build pluggable explainer honoring privacy envelope |

## Security Posture
- [ ] SSRF Protection: Partial — Gaps: No explicit scheme allowlist on redirects, HEAD fallback lacks response size enforcement per spec, redirect targets not revalidated for private ranges on each hop.
- [ ] Secrets Management: Basic — Improvements: Enforce env validation at startup, broaden redaction (URL hashes OK but full URLs logged), document secret rotation.
- [ ] Container Security: Partial — Issues: `reverse-proxy`, `redis`, `postgres` still run as root; `readOnlyRootFilesystem` and resource limits absent; no image scanning pipeline.

## Testing Coverage
- [ ] Unit Tests: ~10% (shared package only) coverage — Target: 80%+ for shared packages.
- [ ] Integration Tests: None — Missing: External API mocks, Redis/Postgres flows, circuit breaker paths.
- [ ] E2E Tests: None — Missing: WhatsApp ingestion → verdict, admin commands, overrides.
- [ ] Load Tests: None — Missing: 100 concurrent URL ingestion scenario and long-haul soak.

## Deployment Readiness
- [ ] Free Tier Cloud Compatibility: Not validated — Compose-only; no Railway/Fly/Render manifests.
- [ ] One-command deployment: Partial (`make up` local only) — Need cloud deploy script/manifest.
- [ ] Health checks: Basic — `/healthz` exists but no dependency readiness checks or WA session telemetry per strategy.
- [ ] Rollback capability: Manual — No documented rollback plan for cloud (only compose note).

## Compliance & Privacy
- [ ] Data retention implementation: Partial — 30-day purge job exists but lacks configuration and monitoring.
- [ ] Consent flow: Missing — No automated consent message template or docs reference.
- [ ] Opt-out mechanism: Partial — Mute command exists but no SLA/documented UX.
- [ ] Audit logging: Missing — No immutable audit trail for overrides, admin actions, or manual verdict changes.
