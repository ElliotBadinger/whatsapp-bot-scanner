# External Reputation Cost Model

This document summarizes the default cost controls we apply when calling third-party
reputation providers, with a focus on VirusTotal.

## VirusTotal Free Tier Limits

VirusTotal's community API allows **4 requests per minute**. Each scan requires a
submission (`POST /urls`) followed by one or more polling requests
(`GET /analyses/{id}`), so we must serialize work carefully to avoid HTTP 429
responses.

The shared `Bottleneck` limiter in `packages/shared/src/reputation/virustotal.ts`
exposes these safeguards:

| Control | Default | Description |
|---------|---------|-------------|
| `VT_REQUESTS_PER_MINUTE` | `4` | Maximum number of VirusTotal requests issued per rolling minute. |
| `VT_REQUEST_JITTER_MS` | `500` | Random delay (0…N ms) injected ahead of each call to reduce bursty traffic. |
| `maxConcurrent` | `1` | Forces submits and polls to run sequentially to stay within quota. |

The limiter refreshes every 60 seconds and publishes instrumentation so you can
track quota usage in Grafana:

- `wbscanner_api_quota_remaining{service="virustotal"}` – number of tokens left in
  the current window (0 means the limiter is waiting for the next minute).
- `wbscanner_api_quota_status{service="virustotal"}` – 1 when tokens are available,
  0 when depleted.
- `wbscanner_api_quota_depleted_total{service="virustotal"}` – increments whenever
  VirusTotal responds with HTTP 429.
- `wbscanner_rate_limiter_delay_seconds{service="virustotal"}` – histogram of the
  queuing delay imposed before a request was executed.

To raise throughput you may gradually increase `VT_REQUESTS_PER_MINUTE` after
upgrading to a commercial tier. We recommend lowering `VT_REQUEST_JITTER_MS`
only if the upstream SLA allows tightly spaced calls; otherwise keep a few
hundred milliseconds of entropy to prevent synchronized bursts when many scans
start at once.

## Operational Guidance

| Scenario | Unique URLs/Day | Cache Hit Rate | Monthly Requests | Estimated Cost |
|----------|----------------|----------------|------------------|----------------|
| Pilot    | 100            | 70%            | 900              | FREE (<500)    |
| Small    | 500            | 70%            | 4,500            | $9/mo          |
| Medium   | 2,000          | 70%            | 18,000           | $36/mo         |
| Large    | 10,000         | 70%            | 90,000           | $180/mo        |

**Cost Controls:**
- 7-day cache TTL reduces repeat lookups
- Monthly quota enforcement halts before paid tier
- Alert fires 48h before monthly reset to plan upgrades

## Additional Considerations

- Redis and Postgres are provisioned via managed services; monitor storage to avoid overage.
- Grafana/Prometheus deployments remain on free-tier container quotas (<1 vCPU, <512MB) to avoid add-on costs.
- Control Plane exposes `wbscanner_api_quota_remaining`/`status` gauges; alerts must stay wired before enabling new paid integrations.

## Governance & Change Control

- Budget Guardrails: Engineering maintains a rolling 3-month forecast for each provider. Raising `WHOISXML_MONTHLY_QUOTA` or upgrading VirusTotal tiers requires approval from security ops and an update to this document.
- Deployment Gates: CI should fail if quota environment variables are unset when paid plans are enabled (`WHOISXML_ENABLE=true`, `VT_API_KEY` present). Configuration reviews confirm cache TTLs and rate limiters match the expected spend envelopes.
- Monitoring Reviews: On-call reviews Grafana's Cost & Quota dashboard weekly to compare actual consumption against projections; Prometheus alerts (`VirusTotalQuotaLow`, `WhoisXMLQuotaNearLimit`) page when remaining tokens breach thresholds.
- Feature Flags: Expensive enrichments (WhoisXML, urlscan) must stay behind feature flags with documented rollback (`WHOISXML_ENABLE`, `URLSCAN_ENABLED`) to rapidly shed cost during incidents.
1. Monitor the quota gauges and counter. Sustained depletion events (`429`s) mean
   the queue is saturated and URLs will take longer to classify.
2. If you raise `VT_REQUESTS_PER_MINUTE`, also update dashboards and alerts that
   watch `wbscanner_api_quota_remaining` so operators understand the new ceiling.
3. Consider pre-filtering low-risk URLs to conserve VirusTotal usage if you are
   close to quota but cannot immediately upgrade your plan.
4. Document any plan upgrades in the runbook so on-call engineers know which rate
   limits are safe during incident response.
