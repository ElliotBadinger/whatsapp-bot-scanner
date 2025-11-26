# Gap Closure Implementation Plan

## Prioritization

### P0: CRITICAL Gaps (Production Blockers)
- [x] CRITICAL-001: Replace BullMQ queue names (`scan:request` etc.) with compatible identifiers across config, env templates, docs, and tests; add regression guard. — ETA: 4h — Status: COMPLETE (2025-10-23)
- [x] CRITICAL-002: Guarantee Phishtank secondary lookup executes whenever GSB returns no match (not just on error/latency); add coverage to ensure redundancy. — ETA: 5h — Status: COMPLETE (2025-10-23)
- [x] CRITICAL-003: Deliver load/performance testing harness (k6 or artillery) plus baseline run capturing P50/P95 targets and resource usage. — ETA: 6h — Status: COMPLETE (2025-10-23)

Total estimated: 15h

### P1: MAJOR Gaps (Strategy Violations)
- [x] MAJOR-001: Implement VirusTotal rate limiting (4 req/min) with jittered scheduling and metrics. — ETA: 4h — Status: COMPLETE (2025-10-23)
- [x] MAJOR-002: Persist urlscan artifacts (screenshots/DOM) and expose retrieval path. — ETA: 6h — Status: COMPLETE (2025-10-23)
- [ ] MAJOR-003: Add Whois cost governance (usage counters, alerts, toggle behaviour) and document quota handling. — ETA: 3h
- [ ] MAJOR-004: Integrate URLExpander (or equivalent) fallback with SSRF-safe handling. — ETA: 4h
- [ ] MAJOR-005: Introduce Unicode homoglyph detection library + targeted tests. — ETA: 5h
- [ ] MAJOR-006: Wire control-plane overrides into orchestrator scoring (manual allow/deny). — ETA: 5h
- [ ] MAJOR-007: Build cache invalidation workflow for rescan requests (Redis + Postgres). — ETA: 4h
- [ ] MAJOR-008: Enforce content-length/timeouts on GET fallback and headless fetches. — ETA: 3h
- [ ] MAJOR-009: Align WA rate limiting with 60 URLs/hour per group & 1000/hour global; add config validation for secrets. — ETA: 4h
- [ ] MAJOR-010: Establish integration & E2E test suites (API mocks, WA/control-plane happy path). — ETA: 10h
- [ ] MAJOR-011: Expand observability (≥20 metrics, ≥10 Grafana panels, ≥6 alerts, circuit metrics). — ETA: 8h
- [ ] MAJOR-012: Update documentation set (Testing.md, Cost_Model.md, Architecture, Threat_Model, Deployment, Admin commands). — ETA: 6h
- [ ] MAJOR-013: Provide cloud deployment template (Railway or Fly.io) with env binding and health checks. — ETA: 6h
- [ ] MAJOR-014: Restore lint/type-check pipeline (shared ESLint config, npm scripts) and CI guidance. — ETA: 3h

Total estimated: 67h

### P2: MINOR Gaps (Polish)
- [ ] MINOR-001: Publish cache hit ratio gauge/alert derived from hit/miss counters. — ETA: 2h
- [ ] MINOR-002: Normalize blocklist weighting so high-confidence score caps at +10 total. — ETA: 2h
- [ ] MINOR-003: Propagate correlation IDs through services/logs. — ETA: 3h
- [ ] MINOR-004: Enhance Grafana dashboards with additional slices (verdict distribution, WA session, queue depth). — ETA: 2h
- [ ] MINOR-005: Update Deployment documentation with BullMQ naming constraints and rollout checklist. — ETA: 1h
- [ ] MINOR-006: Enrich Security/Privacy doc with provider TOS compliance notes. — ETA: 1h
- [ ] MINOR-007: Refresh Architecture doc to reflect circuit breakers, urlscan flow, observability. — ETA: 2h

Total estimated: 13h

## Implementation Sequence

### Day 1: CRITICAL Gaps Only
- [x] CRITICAL-001 — ETA: 4h — Status: COMPLETE
- [x] CRITICAL-002 — ETA: 5h — Status: COMPLETE
- [x] CRITICAL-003 — ETA: 6h — Status: COMPLETE

### Day 2: MAJOR Gaps
- [x] MAJOR-001 — ETA: 4h — Status: COMPLETE
- [x] MAJOR-002 — ETA: 6h — Status: COMPLETE
- [ ] MAJOR-003 — ETA: 3h — Status: NOT STARTED
- [ ] MAJOR-004 — ETA: 4h — Status: NOT STARTED
- [ ] MAJOR-005 — ETA: 5h — Status: NOT STARTED
- [ ] MAJOR-006 — ETA: 5h — Status: NOT STARTED
- [ ] MAJOR-007 — ETA: 4h — Status: NOT STARTED

### Day 3: MAJOR (cont.) + MINOR + Validation
- [ ] MAJOR-008 — ETA: 3h — Status: NOT STARTED
- [ ] MAJOR-009 — ETA: 4h — Status: NOT STARTED
- [ ] MAJOR-010 — ETA: 10h — Status: NOT STARTED
- [ ] MAJOR-011 — ETA: 8h — Status: NOT STARTED
- [ ] MAJOR-012 — ETA: 6h — Status: NOT STARTED
- [ ] MAJOR-013 — ETA: 6h — Status: NOT STARTED
- [ ] MAJOR-014 — ETA: 3h — Status: NOT STARTED
- [ ] MINOR-001 — ETA: 2h — Status: NOT STARTED
- [ ] MINOR-002 — ETA: 2h — Status: NOT STARTED
- [ ] MINOR-003 — ETA: 3h — Status: NOT STARTED
- [ ] MINOR-004 — ETA: 2h — Status: NOT STARTED
- [ ] MINOR-005 — ETA: 1h — Status: NOT STARTED
- [ ] MINOR-006 — ETA: 1h — Status: NOT STARTED
- [ ] MINOR-007 — ETA: 2h — Status: NOT STARTED
- [ ] Full unit/integration/E2E test suite run — ETA: 2h — Status: NOT STARTED
- [ ] Performance validation (load test rerun) — ETA: 3h — Status: NOT STARTED
- [ ] Security audit regression (SSRF, secrets, rate-limit tests) — ETA: 2h — Status: NOT STARTED
