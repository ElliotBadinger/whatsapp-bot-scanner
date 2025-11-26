# Critical and Major Issue Tickets

Collected granular tickets for all CRITICAL blockers and MAJOR issues from [`CRITICAL_ISSUES.md`](CRITICAL_ISSUES.md) and [`MVP_VIABILITY_ANALYSIS.md`](MVP_VIABILITY_ANALYSIS.md).

---

## BLOCKER‑1: WhatsApp Authentication Completely Broken

### B1‑1: Normalize Docker networking for wa‑client and scan‑orchestrator
- **Background:** `wa-client` and `scan-orchestrator` use `network_mode: host` while `redis` uses a bridge network, breaking container‑to‑container networking.
- **Goal:** Put all core services on a single Docker bridge network using service names.
- **Impacted:** [`docker-compose.yml`](docker-compose.yml).
- **Steps:**
  1. Remove `network_mode: host` from `wa-client` and `scan-orchestrator` in [`docker-compose.yml`](docker-compose.yml).
  2. Attach `wa-client`, `scan-orchestrator`, and `redis` to the same named network (for example `internal`).
  3. Update `depends_on` so `redis` starts before `wa-client` and `scan-orchestrator`.
  4. Ensure no other core services require host networking; document any exceptions.
- **Acceptance:** Core services run on the same non‑host network and can resolve one another by service name.

### B1‑2: Fix Redis connectivity for WhatsApp client and scan orchestrator
- **Background:** Containers attempt `redis://127.0.0.1:6379` and fail (`ECONNREFUSED`).
- **Goal:** Standardize Redis URLs on `redis://redis:6379` (or equivalent) inside containers.
- **Impacted:** [`docker-compose.yml`](docker-compose.yml); service configs under [`services/wa-client`](services/wa-client) and [`services/scan-orchestrator`](services/scan-orchestrator).
- **Steps:**
  1. In [`docker-compose.yml`](docker-compose.yml), set `REDIS_URL=redis://redis:6379` for `wa-client` and `scan-orchestrator`.
  2. In each service config, default Redis URL to the same value when running in Docker.
  3. Remove hardcoded `127.0.0.1` Redis host usages in container contexts.
  4. On startup, perform a `PING` to Redis and log clear, non‑crashing errors if unreachable.
- **Acceptance:** Redis connections succeed from `wa-client` and `scan-orchestrator` via service name; `127.0.0.1` errors disappear from logs.

### B1‑3: Harden wa‑client health checks and startup retry logic
- **Background:** `wa-client` becomes UNHEALTHY on transient Puppeteer/WhatsApp Web errors.
- **Goal:** Make health checks and startup behaviour resilient to short‑lived network issues.
- **Impacted:** `healthcheck` for `wa-client` in [`docker-compose.yml`](docker-compose.yml); startup logic in [`services/wa-client/src/index.ts`](services/wa-client/src/index.ts).
- **Steps:**
  1. Ensure `healthcheck` only hits a lightweight endpoint (for example `GET /healthz`) and tune `interval`, `timeout`, `retries`.
  2. Wrap WhatsApp connection in an exponential‑backoff retry loop with a bounded max attempts.
  3. Treat fatal config errors as fail‑fast; treat network errors as retryable.
  4. Emit structured logs/metrics for connection attempts, failures, and successes.
- **Acceptance:** `wa-client` no longer flips UNHEALTHY on brief glitches; logs show bounded retries with clear reason codes.

### B1‑4: Validate WhatsApp authentication end‑to‑end and document flow
- **Background:** No documented procedure to validate WA auth; regressions are hard to detect.
- **Goal:** Establish a repeatable auth validation flow and document it.
- **Impacted:** [`services/wa-client`](services/wa-client); [`docs/RUNBOOKS.md`](docs/RUNBOOKS.md); [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md); new helper [`scripts/test-wa-auth.sh`](scripts/test-wa-auth.sh).
- **Steps:**
  1. Define a manual test: bring up stack, pair WA (QR or code), send URL, verify verdict postback.
  2. Execute on a clean environment and capture canonical logs/screenshots.
  3. Document steps and common failures in [`docs/RUNBOOKS.md`](docs/RUNBOOKS.md).
  4. Optionally add [`scripts/test-wa-auth.sh`](scripts/test-wa-auth.sh) to perform basic connectivity checks.
- **Acceptance:** Following the doc, an operator can pair WA and see a verdict for a test URL; common auth issues have documented fixes.

---

## BLOCKER‑2: Test Suite Failures

### B2‑1: Fix TypeScript type mismatches in ssrf.test.ts
- **Background:** `packages/shared/src/__tests__/ssrf.test.ts` has incorrect DNS mocks causing TypeScript compile failures.
- **Goal:** Eliminate all TS compile errors in the test suite.
- **Impacted:** [`packages/shared/src/__tests__/ssrf.test.ts`](packages/shared/src/__tests__/ssrf.test.ts).
- **Steps:**
  1. Update DNS and other mocks in [`ssrf.test.ts`](packages/shared/src/__tests__/ssrf.test.ts) to match the correct Node.js types (for example `LookupAddress`).
  2. Run `npm test --workspaces` and fix any additional type errors surfaced.
- **Acceptance:** `npm test --workspaces` runs without TS compilation errors; no new `any` casts introduced solely to silence types.

### B2‑2: Raise unit test coverage for core URL and scoring logic to ≥70% for MVP
- **Background:** Global coverage is ~56%; high‑risk modules (URL normalization, scoring, cache keys) are under‑tested.
- **Goal:** Reach ≥70% global coverage, focusing on core URL/scoring/caching paths.
- **Impacted:** URL utilities under [`packages/shared/src/url`](packages/shared/src/url); scoring under [`packages/shared/src/scoring`](packages/shared/src/scoring); cache under [`packages/shared/src/cache`](packages/shared/src/cache); tests under [`packages/shared/src/__tests__`](packages/shared/src/__tests__).
- **Steps:**
  1. Run `npm test --workspaces -- --coverage` and identify low‑coverage core modules.
  2. Add tests for URL edge cases, scoring corner cases, and cache key uniqueness/equivalence.
  3. Iterate until global coverage ≥70% and key modules significantly improve.
- **Acceptance:** Coverage report shows ≥70% line/branch coverage; core pipeline modules are well covered with stable, non‑flaky tests.

### B2‑3: Add integration tests for Redis, queues, and scanning pipeline
- **Background:** No integration tests validate cross‑service interactions; failures may only appear in production.
- **Goal:** Create integration tests that exercise Redis, the queue, and scanners end‑to‑end.
- **Impacted:** [`tests/integration`](tests/integration); helpers under [`scripts`](scripts) and [`packages/shared`](packages/shared); root [`package.json`](package.json).
- **Steps:**
  1. Design a scenario that enqueues a URL similarly to `wa-client` and observes a verdict.
  2. Implement integration tests under [`tests/integration`](tests/integration) using existing test tooling.
  3. Ensure tests are idempotent and clean up any created jobs/data.
  4. Wire integration tests into `npm test --workspaces` via [`package.json`](package.json).
- **Acceptance:** At least one integration test validates URL ingestion → scan → verdict; failures in Redis/queue integration cause test failures.

---

## BLOCKER‑3: No Performance/Load Testing Evidence

### B3‑1: Extend http-load.js to exercise real URL scanning pipeline
- **Background:** [`tests/load/http-load.js`](tests/load/http-load.js) only hits `/healthz` and does not touch the real scanning path.
- **Goal:** Drive the actual scan endpoint(s) to test Redis, queues, and scanners.
- **Impacted:** [`tests/load/http-load.js`](tests/load/http-load.js).
- **Steps:**
  1. Identify the public HTTP endpoint that triggers URL scans.
  2. Update [`http-load.js`](tests/load/http-load.js) to send scan requests (safe/suspicious/repeated URLs) instead of only `/healthz`.
  3. Parameterize concurrency, URL count, and target host.
- **Acceptance:** Running the load script enqueues and processes real scans, visible in logs and metrics.

### B3‑2: Measure and report P50/P95 latencies and resource usage under load
- **Background:** No latency or resource measurements exist for real scans.
- **Goal:** Capture latency distribution and basic CPU/RAM usage during load tests.
- **Impacted:** [`tests/load/http-load.js`](tests/load/http-load.js); [`docs/MONITORING.md`](docs/MONITORING.md) or new `docs/PERFORMANCE.md`.
- **Steps:**
  1. Enhance [`http-load.js`](tests/load/http-load.js) to track per‑request durations and print P50/P90/P95 latencies and error rates.
  2. While running the load test, record container CPU/RAM via `docker stats` or existing metrics.
  3. Document at least one baseline run (config + results) in monitoring/performance docs.
- **Acceptance:** A single command produces latency percentiles and error rates; docs contain a baseline performance snapshot.

### B3‑3: Add basic memory/CPU leak detection for long‑running scans
- **Background:** Long‑run stability (leaks, CPU creep) is unvalidated.
- **Goal:** Provide a simple process to check for leaks under extended load (for example 1000 URLs).
- **Impacted:** [`tests/load/http-load.js`](tests/load/http-load.js); [`docs/MONITORING.md`](docs/MONITORING.md).
- **Steps:**
  1. Define a long‑run load variant (for example, 1000 URLs over 30–60 minutes).
  2. Document how to monitor container memory/CPU over the run.
  3. Capture at least one run and file follow‑up issues if leaks are observed.
- **Acceptance:** There is a documented long‑run procedure; at least one baseline shows no obvious leak or a follow‑up bug exists.

---

## BLOCKER‑4: Incomplete Setup/Onboarding Flow

### B4‑1: Introduce a hobby‑mode env template with minimal required config
- **Background:** `.env` requires ~170 vars and many API keys; overwhelming for hobby users.
- **Goal:** Provide `.env.hobby` with only essential fields and safe defaults.
- **Impacted:** [`\.env.example`](.env.example); new `.env.hobby`; [`setup.sh`](setup.sh).
- **Steps:**
  1. Identify minimal configuration for local hobby use (WA account, VirusTotal key, Redis/DB basics).
  2. Create `.env.hobby` containing only required vars plus comments and defaults.
  3. Ensure [`setup.sh`](setup.sh) can copy `.env.hobby` to `.env` for hobby mode.
- **Acceptance:** A new user can start from `.env.hobby` and avoid editing 100+ variables.

### B4‑2: Relax assertEssentialConfig to make non‑core APIs optional
- **Background:** [`packages/shared/src/config.ts`](packages/shared/src/config.ts) enforces both `VT_API_KEY` and `GSB_API_KEY`, making them effectively mandatory.
- **Goal:** Require only VirusTotal for hobby deployments; make other providers optional with degraded behaviour.
- **Impacted:** [`packages/shared/src/config.ts`](packages/shared/src/config.ts).
- **Steps:**
  1. Update `assertEssentialConfig` so only `VT_API_KEY` is treated as essential.
  2. Introduce `enabled` flags for optional providers and set them false when keys are missing.
  3. Guard external API calls with the corresponding `enabled` flag.
  4. Add tests for “only VT present” vs “all present” vs “VT missing” cases.
- **Acceptance:** App starts successfully with only `VT_API_KEY` set; missing optional keys result in graceful skips, not process exit.

### B4‑3: Wire hobby‑mode into setup.sh and add preflight validation
- **Background:** Even with `.env.hobby`, there is no one‑shot, validated hobby setup flow.
- **Goal:** Make `./setup.sh --hobby-mode` create and validate a minimal env.
- **Impacted:** [`setup.sh`](setup.sh); possible helper scripts under [`scripts`](scripts).
- **Steps:**
  1. Implement `--hobby-mode` in [`setup.sh`](setup.sh) to copy `.env.hobby` to `.env` when absent.
  2. Prompt for `VT_API_KEY` and inject it into `.env` if not set.
  3. Add preflight checks for required tools and env values and print clear “Next steps”.
- **Acceptance:** On a fresh clone, `./setup.sh --hobby-mode` yields a valid `.env` and guidance for `make build && make up`.

### B4‑4: Write a 5‑minute hobby quickstart guide
- **Background:** No concise, hobby‑oriented quickstart exists.
- **Goal:** Deliver a single, happy‑path guide from clone to first verdict in ≤15 minutes.
- **Impacted:** [`docs/getting-started.md`](docs/getting-started.md) or `docs/hobby-quickstart.md`; [`README.md`](README.md).
- **Steps:**
  1. Document prerequisites, `./setup.sh --hobby-mode`, `make build && make up`, pairing WA, and sending a test URL.
  2. Add a short troubleshooting subsection and link to the main troubleshooting guide.
  3. Link the quickstart prominently from [`README.md`](README.md).
- **Acceptance:** A technical hobby user can achieve a first successful scan in under 15 minutes by following the guide.

### B4‑5: Add setup validation and troubleshooting entrypoints
- **Background:** When setup fails, there is no structured validation or troubleshooting flow.
- **Goal:** Provide a validation script and doc pointers for common setup failures.
- **Impacted:** New [`scripts/validate-setup.sh`](scripts/validate-setup.sh); [`docs/RUNBOOKS.md`](docs/RUNBOOKS.md); [`docs/TESTING.md`](docs/TESTING.md).
- **Steps:**
  1. Implement `scripts/validate-setup.sh` to check env vars, Docker services, and basic API connectivity.
  2. Print clear OK/FAIL statuses plus links into troubleshooting docs.
  3. Update docs to reference the validation script and how to interpret results.
- **Acceptance:** Running the validation script on misconfigured setups surfaces actionable errors; successful runs give confidence the stack will start.

---

## BLOCKER‑5: Railway Deployment Configuration Mismatch

### B5‑1: Decide and implement a consistent database strategy (SQLite vs PostgreSQL)
- **Background:** Local uses SQLite, Railway expects PostgreSQL; risk of schema drift and surprises.
- **Goal:** Choose a single DB strategy for MVP and align local and Railway configs.
- **Impacted:** [`docker-compose.yml`](docker-compose.yml); [`railway.toml`](railway.toml); [`db/migrations`](db/migrations).
- **Steps:**
  1. Decide whether MVP uses SQLite everywhere or PostgreSQL everywhere.
  2. Update [`docker-compose.yml`](docker-compose.yml) and [`railway.toml`](railway.toml) to match the chosen engine.
  3. Verify migrations under [`db/migrations`](db/migrations) work for the chosen engine.
- **Acceptance:** Local and Railway deployments share the same DB engine and schema; no code assumes SQLite while production uses Postgres (or vice versa).

### B5‑2: Ensure migrations run automatically on Railway deployment
- **Background:** Migrations do not currently auto‑run on Railway.
- **Goal:** Run DB migrations as part of each Railway deployment.
- **Impacted:** [`railway.toml`](railway.toml); migration tooling under [`scripts`](scripts).
- **Steps:**
  1. Standardize a migration command (for example `npm run migrate`).
  2. Configure [`railway.toml`](railway.toml) `deploy`/`postDeploy` to invoke migrations.
  3. Document migration behaviour and rollback steps.
- **Acceptance:** Fresh Railway deployments create/update the schema automatically; failed migrations are visible and recoverable.

### B5‑3: Add a Railway deployment runbook
- **Background:** Cloud deployment is effectively untested and undocumented.
- **Goal:** Provide a step‑by‑step Railway deployment guide.
- **Impacted:** [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md); [`railway.toml`](railway.toml).
- **Steps:**
  1. Extend [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) with Railway prerequisites, env/secrets setup, deployment steps, migration handling, and validation checks.
  2. Include rollback instructions for failed deployments.
- **Acceptance:** A developer can follow the runbook to deploy and validate the app on Railway from scratch.

### B5‑4: Add health checks and validation for Railway deployment
- **Background:** Without health checks, Railway may route traffic to unhealthy containers.
- **Goal:** Expose health endpoints and configure Railway to use them.
- **Impacted:** Service health endpoints; [`railway.toml`](railway.toml); [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).
- **Steps:**
  1. Ensure each externally exposed service implements a simple `/healthz` that checks process, DB, and Redis connectivity.
  2. Configure [`railway.toml`](railway.toml) health checks to use these endpoints.
  3. Document how to inspect and debug Railway health status.
- **Acceptance:** Railway reports healthy services when the system is functional and surfaces clear failures when dependencies break.

---

## MAJOR‑1: Documentation Gaps

### M1‑1: Complete hobby quickstart documentation
- **Background:** Hobby quickstart is missing or incomplete.
- **Goal:** Ship a polished quickstart aligned with hobby mode (see B4‑4).
- **Impacted:** [`docs/getting-started.md`](docs/getting-started.md) or `docs/hobby-quickstart.md`; [`README.md`](README.md).
- **Steps:** Expand B4‑4 into final, polished docs including screenshots or gifs.
- **Acceptance:** Quickstart is discoverable, up to date, and sufficient for a hobby deployment.

### M1‑2: Add architecture overview diagram and explanation
- **Background:** Newcomers lack a mental model of services and data flow.
- **Goal:** Provide a high‑level diagram and narrative of the architecture.
- **Impacted:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md); [`docs/assets`](docs/assets).
- **Steps:**
  1. Draw a simple diagram showing WhatsApp client, scan orchestrator, Redis, external APIs, and observability.
  2. Embed it in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) with brief descriptions.
- **Acceptance:** After reading the doc, a new contributor understands the end‑to‑end flow of a URL through the system.

### M1‑3: Write troubleshooting guide with common errors and fixes
- **Background:** No central troubleshooting reference for common operational failures.
- **Goal:** Provide symptom‑driven troubleshooting content.
- **Impacted:** [`docs/RUNBOOKS.md`](docs/RUNBOOKS.md) or `docs/TROUBLESHOOTING.md`.
- **Steps:**
  1. Document top issues (unhealthy `wa-client`, Redis failures, missing keys, DB migration errors, auth issues).
  2. For each, list symptoms, likely causes, and step‑by‑step fixes.
- **Acceptance:** Operators can match real incidents to documented patterns and resolve them using the guide.

### M1‑4: Document API provider TOS constraints and cost expectations
- **Background:** External APIs differ in ToS, quotas, and cost; users are uninformed.
- **Goal:** Summarize ToS and cost considerations for each provider.
- **Impacted:** [`docs/COST_MODEL.md`](docs/COST_MODEL.md); [`docs/SECURITY_PRIVACY.md`](docs/SECURITY_PRIVACY.md).
- **Steps:**
  1. For each provider, record presence of free tier, rate limits, and key usage restrictions.
  2. Estimate typical hobby usage and monthly cost where applicable.
  3. Connect privacy/ToS constraints to config guidance.
- **Acceptance:** Users can select providers confidently for hobby use with clear expectations about limits and costs.

---

## MAJOR‑2: External API Dependency Hell

### M2‑1: Add config flags to individually disable external APIs
- **Background:** Many APIs are effectively mandatory; users cannot easily disable them.
- **Goal:** Allow each external provider to be toggled on/off via config without breaking scans.
- **Impacted:** [`packages/shared/src/config.ts`](packages/shared/src/config.ts); scanner and circuit‑breaker logic in services.
- **Steps:**
  1. Introduce `enabled` flags in shared config for each external API.
  2. Guard each external call with the relevant `enabled` flag and log when providers are disabled.
  3. Document flags and example hobby configs with reduced dependencies.
- **Acceptance:** Any external provider can be disabled without breaking the pipeline; logs clearly indicate disabled providers.

### M2‑2: Implement heuristic‑only scan mode
- **Background:** When all providers are down/disabled, the system silently degrades with no explicit heuristic‑only behaviour.
- **Goal:** Provide a well‑defined heuristic‑only mode when external APIs are unavailable.
- **Impacted:** Scoring and scanning logic; circuit breaker implementation.
- **Steps:**
  1. Define signals used in heuristic‑only mode (domain age, TLD, local lists, etc.).
  2. Detect when all providers are disabled or tripped and bypass external calls.
  3. Produce verdicts based purely on heuristics and mark responses as “heuristics only”.
- **Acceptance:** With all external APIs off, scans still complete with heuristic verdicts; responses indicate degraded mode.

### M2‑3: Publish a feature matrix for external API configurations
- **Background:** Users cannot see how different API combinations affect features.
- **Goal:** Provide a simple feature matrix mapping providers to capabilities.
- **Impacted:** [`docs/COST_MODEL.md`](docs/COST_MODEL.md) or `docs/FEATURE_MATRIX.md`; [`README.md`](README.md).
- **Steps:**
  1. List key features and which providers enable or enhance them.
  2. Present as a markdown table and link from README and cost docs.
- **Acceptance:** Hobby users can choose a provider set based on features vs cost/complexity tradeoffs.

---

## MAJOR‑3: No Working Example/Demo

### M3‑1: Add synthetic WhatsApp test dataset and replay script
- **Background:** No test messages or automation exist to exercise the scanner with sample data.
- **Goal:** Provide a synthetic dataset and script to replay it through the pipeline.
- **Impacted:** New fixtures under `docs/examples` or `tests/fixtures`; new [`scripts/replay-test-messages.ts`](scripts/replay-test-messages.ts).
- **Steps:**
  1. Create a small dataset of safe/suspicious/malicious URLs with expected verdicts.
  2. Implement a script to submit them via the normal scan entrypoint and collect outputs.
  3. Document how to run the script in testing docs.
- **Acceptance:** Running the replay script in a dev environment exercises the scanner and prints expected verdicts.

### M3‑2: Record and publish a short demo video
- **Background:** No video shows what the tool does or how it behaves.
- **Goal:** Provide a short screencast of setup and example scans.
- **Impacted:** [`README.md`](README.md); assets under `docs/assets`.
- **Steps:** Record a 2–5 minute demo (start stack, pair WA, send URLs, see verdicts) and link it from README and quickstart.
- **Acceptance:** New users can watch the video to understand the value and expected UX of the tool.

### M3‑3: Provide example verdict outputs in docs
- **Background:** No textual examples of inputs and resulting verdicts.
- **Goal:** Document a few representative input→verdict examples.
- **Impacted:** [`docs/TESTING.md`](docs/TESTING.md) or [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
- **Steps:** Capture a few real scan outputs (redacted as needed) and document URL, verdict, and main contributing signals.
- **Acceptance:** Docs include at least benign/suspicious/malicious examples with explanations.

---

## MAJOR‑4: Cache Hit Ratio Metric Not Implemented

### M4‑1: Implement cache hit/miss metrics and aggregate hit ratio
- **Background:** Cache hit ratio target (for example 70%) cannot be measured.
- **Goal:** Emit cache hit/miss metrics and compute hit ratio.
- **Impacted:** Cache layer (for example in `packages/shared` or orchestrator); observability/metrics config.
- **Steps:**
  1. Add counters for hits/misses/evictions in the cache implementation.
  2. Export them via the existing metrics endpoint.
  3. Define a hit‑ratio expression (hits / (hits + misses)).
- **Acceptance:** Metrics endpoint exposes cache counters; hit ratio can be graphed or queried over time.

### M4‑2: Add cache hit ratio to dashboards and docs
- **Background:** Even with metrics, operators need dashboards and guidance.
- **Goal:** Surface cache hit ratio in Grafana and describe how to interpret it.
- **Impacted:** Grafana dashboards under [`grafana`](grafana); [`docs/MONITORING.md`](docs/MONITORING.md).
- **Steps:**
  1. Add a Grafana panel for cache hit ratio.
  2. Document target ranges and troubleshooting steps for low hit ratio.
- **Acceptance:** Operators can see cache hit ratio in dashboards and know how to react when it is poor.

---

## MAJOR‑5: Circuit Breaker Degraded Mode Missing

### M5‑1: Emit events/metrics when all external APIs are unavailable
- **Background:** When all providers fail, the system silently degrades.
- **Goal:** Detect and surface a “fully degraded external scan” state.
- **Impacted:** Circuit breaker implementation; metrics/logging.
- **Steps:**
  1. Detect when all configured providers are open/disabled.
  2. Emit a metric (for example `external_scanners_degraded`) and a clear WARN/ERROR log when this state is entered.
  3. Reset the metric/log when at least one provider recovers.
- **Acceptance:** Degraded external mode is visible via metrics/logs and covered by tests.

### M5‑2: Add operator alerts for degraded external scan mode
- **Background:** Without alerts, degraded mode may go unnoticed.
- **Goal:** Notify operators when the system is in degraded external mode.
- **Impacted:** Alert rules under `observability` or [`grafana`](grafana); [`docs/MONITORING.md`](docs/MONITORING.md).
- **Steps:**
  1. Add an alert that fires when degraded‑mode metric is non‑zero for N minutes.
  2. Document recommended operator actions when the alert triggers.
- **Acceptance:** A sustained degraded mode raises alerts in the monitoring channel with clear guidance.

### M5‑3: Document degraded mode behaviour and operator actions
- **Background:** Operators need to know what degraded mode implies and how to respond.
- **Goal:** Add runbook content explaining degraded behaviour and recovery.
- **Impacted:** [`docs/RUNBOOKS.md`](docs/RUNBOOKS.md); [`docs/MONITORING.md`](docs/MONITORING.md).
- **Steps:** Describe what functionality is reduced, how verdict quality is affected, and how to restore normal operation.
- **Acceptance:** Operators can follow the runbook to diagnose and recover from degraded mode incidents.

---

## MAJOR‑6: Risk Scoring Can Exceed Defined Range

### M6‑1: Enforce 0–15 range in risk scoring algorithm
- **Background:** Current scoring can exceed the documented 0–15 range.
- **Goal:** Ensure final scores are always within 0–15.
- **Impacted:** Scoring implementation under [`packages/shared/src/scoring`](packages/shared/src/scoring); tests under [`packages/shared/src/__tests__`](packages/shared/src/__tests__).
- **Steps:**
  1. Clamp or re‑weight scores so the maximum path cannot exceed 15.
  2. Add tests asserting scores never exceed 15, even with many blocklist hits.
- **Acceptance:** All code paths produce scores within 0–15; tests enforce the invariant.

### M6‑2: Audit downstream consumers of risk score and adjust thresholds
- **Background:** Consumers may assume scores in a different range or distribution.
- **Goal:** Align downstream thresholds and assumptions with the enforced 0–15 range.
- **Impacted:** All modules comparing risk scores for decisions and caching.
- **Steps:**
  1. Search for risk score comparisons and thresholds and review their semantics.
  2. Adjust thresholds and comments to match the enforced range.
  3. Add tests for representative threshold decisions.
- **Acceptance:** No consumer expects scores >15; thresholds and docs are consistent with the scoring model.

---

## MAJOR‑7: No End‑to‑End Automation Test

### M7‑1: Implement an automated end‑to‑end test from message‑like input to verdict
- **Background:** Only manual tests validate message→scan→verdict; regressions are likely.
- **Goal:** Create an automated E2E test that exercises as much real stack as feasible in CI.
- **Impacted:** [`tests/e2e`](tests/e2e); docker‑compose test overrides; root [`package.json`](package.json).
- **Steps:**
  1. Choose an E2E path (HTTP/queue entrypoints or WA stub).
  2. Implement tests that submit a URL and wait for a verdict observable in DB/queue/log/API.
  3. Keep runtime reasonable (<1–2 minutes) for CI.
- **Acceptance:** A CI‑run E2E test fails whenever the message→verdict path is broken.

### M7‑2: Integrate end‑to‑end tests into CI pipeline
- **Background:** E2E tests must run automatically for core branches.
- **Goal:** Ensure E2E suite is wired into CI.
- **Impacted:** CI workflows under [`.github`](.github); root [`package.json`](package.json).
- **Steps:**
  1. Add `npm run test:e2e` script to [`package.json`](package.json).
  2. Update CI workflows to run E2E tests on main/release branches after unit/integration tests.
- **Acceptance:** CI fails when E2E tests fail; passing CI implies basic end‑to‑end behaviour is intact.

---

## MAJOR‑8: Observability Stack Overhead for Hobby Use

### M8‑1: Provide a minimal observability mode in docker-compose and Makefile
- **Background:** Full observability stack (Grafana, Prometheus, Uptime Kuma) is heavy for hobby deployments.
- **Goal:** Make observability optional and provide a minimal default stack.
- **Impacted:** [`docker-compose.yml`](docker-compose.yml); [`Makefile`](Makefile); observability configs under `observability` and [`grafana`](grafana).
- **Steps:**
  1. Move observability services into a separate compose profile/file (for example `docker-compose.observability.yml`).
  2. Add `make up-minimal` and `make up-full` targets referencing minimal vs full stacks.
  3. Default hobby docs to the minimal stack.
- **Acceptance:** Hobby users can run a core‑only stack with one make target; observability runs only when explicitly enabled.

### M8‑2: Document resource requirements and observability tradeoffs
- **Background:** Users lack visibility into resource usage differences between minimal/full stacks.
- **Goal:** Document CPU/RAM requirements and when to use each mode.
- **Impacted:** [`docs/MONITORING.md`](docs/MONITORING.md); [`docs/COST_MODEL.md`](docs/COST_MODEL.md).
- **Steps:**
  1. Measure resource usage for minimal and full stacks via `docker stats` or existing metrics.
  2. Publish approximate resource tables and recommendations.
- **Acceptance:** Docs clearly state recommended hardware for minimal vs full deployments; hobby guidance prefers minimal mode.