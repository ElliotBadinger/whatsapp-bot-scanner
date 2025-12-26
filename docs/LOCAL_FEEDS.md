# Local Threat Feeds (Offline Scanning)

This workflow keeps a local cache of threat intelligence so scans can run without live API calls.

## Update the local feeds

```bash
npm run update-local-feeds
```

This writes to `storage/feeds/`:

- `majestic-top-domains.txt`
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

## Notes

- Feeds update periodically; run the updater via cron to keep them fresh.
- Scans use cached files only (no network) once the feeds are downloaded.
