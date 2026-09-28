# Dataset Benchmarks

Runs the local offline scanner against a small sample of public, recent datasets:

- **OpenPhish** feed (phishing URLs)
- **URLhaus** recent URLs (malware distribution)
- **Majestic Million (head)** (benign domains; fetched via HTTP range request)
- Optional: **Hard-Mode URL Threats** report patterns (local-only) for "suspicious" stress tests

## Run

```bash
npm run test:datasets
```

## Optional local report

If you have the local report file, point the test at it:

```bash
WBSCANNER_DATASET_REPORT_PATH="/path/to/Hard-Mode URL Threats_ High-Signal Data & Heuristics for Next-Gen Detection.md" npm run test:datasets
```

Datasets are cached under `storage/datasets/` (gitignored).
