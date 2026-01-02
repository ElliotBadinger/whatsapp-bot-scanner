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
- Research datasets: PhreshPhish, URL-Phish, StealthPhisher, PhishOFE.
- Reports/patterns: local report extraction from `scripts/dataset reports`.

All are normalized into JSONL under `storage/robustness/sources/`.

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

## Metrics

The scan output now reports:

- `precisionByLabel`, `recallByLabel`, `f1ByLabel`
- `flagged` binary metrics: precision, recall, TPR, FPR
- `tricky` slice rates (flagged + blocked)
- Full confusion matrix per source

## Avoiding Leakage

- Run two passes:
  - Generalization: `ROBUSTNESS_DISABLE_LOCAL_FEEDS=true`
  - Feed coverage: local feeds enabled (default)
- Never refresh feeds during scan runs.
- Snapshot fixtures and record `fetchedAt` in manifests for drift tracking.
