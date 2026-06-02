# Offline Benchmark Suite

This suite consolidates offline URL-intel benchmarks into a single workflow
that supports real-world threat feeds, static research datasets, and reproducible
offline scan fixtures.

## Goals

- Keep scan-time fully offline (no HTTP, no live enrichers).
- Track drift using dated snapshots.
- Measure detection on multiple vectors (brand, redirects, cloud staging).
- Avoid feed leakage when measuring generalization.

## Fixture Format (JSONL)

Each line is a single test fixture:

- `url` (string, required): canonical input URL.
- `inputUrl` (string, optional): raw input when `url` is normalized.
- `finalUrl` (string, optional): final destination for offline chains.
- `redirectChain` (array, optional): ordered URL chain (offline fixture).
- `metadata` (object, optional): precomputed signals (e.g. `domainAgeDays`).
- `signals` (object, optional): precomputed scanner signals (offline-only).
- `tags` (array, optional): categories for slicing (brand, redirect, cloud, etc).
- `label` (string): `benign`, `suspicious`, `malicious`, `tricky`.
- `source` (string): dataset id.
- `fetchedAt` (string): ISO timestamp.

## Datasets and Sources

The consolidated fetcher lives at `scripts/robustness/fetch-robustness-datasets.py`.
It supports:

- Near-real-time feeds: OpenPhish, URLHaus, CERT.PL, SANS, PhishTank.
- Live IP/IOC feeds: ThreatFox, SSLBL.
- Redirect-chain fixtures: urlscan export (`URLSCAN_EXPORT_PATH`).
- Research datasets: PhreshPhish, URL-Phish, StealthPhisher, PhishOFE, CIC-Trap4Phish (URLs + QR), DynaPD kits.
- Offline snapshots: CISA AIS (TAXII/STIX), Censys Threats, URLx (Hunt.io), MalwareBazaar, Common Crawl CC-MAIN, Tranco (top domains + real URLs), Redirect Patterns (Internet Archive), SaaS redirector wrappers.
- Reports/patterns: local report extraction from `scripts/dataset reports`.

All are normalized into JSONL under `storage/robustness/sources/`.

## Dedup + Allowlist

- Fixtures are deduplicated by exact URL and registrable domain.
- Benign-heavy sources can be labeled `benign-hard`; these are filtered to an allowlisted registrable-domain set (seeded from Tranco or a custom allowlist).
- Provide allowlist files via `--allowlist <path>` or `ROBUSTNESS_ALLOWLIST_PATHS=/path/a.txt,/path/b.jsonl`.

## Offline Scan Controls

- Disable local feeds to measure generalization: `ROBUSTNESS_DISABLE_LOCAL_FEEDS=true`
- Force offline scan (no feed refresh): `--offline` or `--skip-feed-refresh`
- Limit dataset size for quick runs: `--max-rows 2000`
- Skip baseline link-corpus build: `--skip-baseline`

## Workflow

Fetch data (refresh-time only):

```bash
node scripts/robustness-suite.mjs \
  --mode fetch \
  --skip-baseline \
  --max-rows 2000 \
  --source openphish_feed \
  --source urlhaus_feed \
  --source threatfox_full \
  --source urlscan_export \
  --source phreshphish \
  --source phishing_database
```

Run offline scan (scan-time, no network):

```bash
ROBUSTNESS_DISABLE_LOCAL_FEEDS=true \
node scripts/robustness-suite.mjs \
  --mode scan \
  --skip-feed-refresh \
  --offline
```

## Redirect-Chain Fixtures (urlscan)

Provide a local export file before fetch:

```bash
export URLSCAN_EXPORT_PATH=/path/to/urlscan-export.jsonl
```

The ingestion extracts `inputUrl`, `finalUrl`, and `redirectChain` when present.

To generate a larger synthetic export:

```bash
python scripts/benchmarks/generate-urlscan-fixtures.py \
  --out storage/robustness/urlscan-export.jsonl \
  --count 500
```

## Offline Snapshot Inputs

The fetcher reads local snapshots via environment variables:

- `CIC_TRAP4PHISH_ARCHIVE`, `CIC_TRAP4PHISH_QR_ARCHIVE`
- `DYNAPD_ARCHIVE` (optional synthetic base via `DYNAPD_SYNTHETIC_BASE`)
- `PHISHOFE_ARCHIVE`, `URL_PHISH_ARCHIVE`, `STEALTHPHISHER_ARCHIVE`
- `URLSCAN_EXPORT_PATH`
- `CISA_AIS_ARCHIVE`, `CENSYS_THREATS_ARCHIVE`, `URLX_ARCHIVE`
- `MALWAREBAZAAR_ARCHIVE`
- `REDIRECT_PATTERNS_ARCHIVE`, `COMMON_CRAWL_SNAPSHOT`
- `TRANCO_TOP_DOMAINS_PATH`, `TRANCO_REAL_URLS_ARCHIVE`
- `REDIRECTOR_WRAPPERS_PATH`

If QR payloads are stored as images, install `opencv-python` via
`scripts/robustness/requirements.txt` to decode QR URLs.

## Metrics

The scan output now reports:

- `precisionByLabel`, `recallByLabel`, `f1ByLabel`
- `flagged` binary metrics: precision, recall, TPR, FPR
- `tricky` slice rates (flagged + blocked)
- Full confusion matrix per source

## Gates (CI-ready)

Define red/amber/green thresholds in `benchmarks/gates.json`.
Generate a report file and run the checker:

```bash
node scripts/robustness-suite.mjs --mode scan --skip-feed-refresh --offline > benchmarks/report.json
npm run benchmarks:check
```

## Avoiding Leakage

- Run two passes:
  - Generalization: `ROBUSTNESS_DISABLE_LOCAL_FEEDS=true`
  - Feed coverage: local feeds enabled (default)
- Never refresh feeds during scan runs.
- Snapshot fixtures and record `fetchedAt` in manifests for drift tracking.
