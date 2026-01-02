# Local Threat Feeds (Offline Scanning)

This workflow keeps a local cache of threat intelligence so scans can run without live API calls.

## Update the local feeds

```bash
npm run update-local-feeds
```

This writes to `storage/feeds/`:

- `majestic-top-domains.txt`
- `certpl-domains.txt`
- `phishtank.txt` (only when PHISHTANK_API_KEY or PHISHTANK_FEED_URL is set)
- `openphish.txt`
- `urlhaus.txt`
- `sans-domains.txt`
- `summary.json`

## Configure (optional)

Environment variables:

- `LOCAL_FEED_DIR` (default: `storage/feeds`)
- `MAJESTIC_FEED_URL`
- `MAJESTIC_TOP_LIMIT` (default: `10000`)
- `MAJESTIC_TOP_LOCAL_PATH`
- `CERTPL_FEED_URL`
- `CERTPL_LOCAL_PATH`
- `PHISHTANK_API_KEY` (optional)
- `PHISHTANK_FEED_URL` (optional)
- `PHISHTANK_LOCAL_PATH`
- `OPENPHISH_FEED_URL`
- `URLHAUS_FEED_URL`
- `SANS_DOMAIN_FEED_URL`
- `SANS_SCORE_MIN` (default: `3`)
- `LOCAL_FEEDS_ENABLED` (`true`/`false`)

## Evaluate offline coverage

```bash
LOCAL_FEEDS_ENABLED=true \
npm run scan-corpus
```

For benchmark generalization (avoid feed leakage):

```bash
ROBUSTNESS_DISABLE_LOCAL_FEEDS=true \
npm run robustness:scan
```

## Notes

- Feeds update periodically; run the updater via cron to keep them fresh.
- Scans use cached files only (no network) once the feeds are downloaded.
