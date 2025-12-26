# Link Corpus Workflow

Build a fresh corpus of URLs (benign, suspicious, malicious, and tricky) for stress testing.

## Build the corpus

```bash
npm run link-corpus -- \
  --out storage/link-corpus.jsonl \
  --summary storage/link-corpus.summary.json \
  --benign-limit 500 \
  --malicious-limit 500 \
  --suspicious-limit 300 \
  --tricky-limit 200
```

The JSONL output uses:

- `url`
- `label` (`benign`, `suspicious`, `malicious`, `tricky`)
- `source`
- `fetchedAt`

## Evaluate scanner performance (offline)

```bash
LOCAL_FEEDS_ENABLED=true \
npm run scan-corpus
```

This runs the local scanner against the corpus and prints verdict counts and average scores per label.

## Enqueue into the scan-request queue

```bash
REDIS_URL=redis://localhost:6379 \
npm run link-corpus -- \
  --enqueue \
  --queue scan-request \
  --enqueue-rate 5
```

This pushes scan jobs at ~5 URLs per second.

## Override feed URLs

Set these env vars to point at mirrors or internal feeds:

- `MAJESTIC_FEED_URL`
- `OPENPHISH_FEED_URL`
- `URLHAUS_FEED_URL`
- `SANS_DOMAIN_FEED_URL`

## Safety notes

- The corpus contains real malicious URLs. Do not open the links in a browser.
- Use isolated environments when replaying the dataset.
