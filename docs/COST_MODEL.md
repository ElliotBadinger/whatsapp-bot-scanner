# Cost Model

## VirusTotal Quota Management

**Free Tier Limits:**
- 4 requests per minute
- 500 requests per day

**Rate Limiting Strategy:**
- Bottleneck scheduler enforces 4 req/min
- Reservoir refills every 60 seconds with 250ms jitter
- Hard stop on HTTP 429 (switches to URLhaus fallback)

**Quota Tracking:**
- Metric: `wbscanner_api_quota_remaining{service="virustotal"}` (0-4 tokens)
- Alerting: `VirusTotalQuotaLow` and `VirusTotalQuotaExhausted`
- Failure path: gracefully defers to URLhaus intelligence

**Cost Projections:**
- At 70% cache hit rate, 10k URLs/day ≈ 3k API calls
- Free tier supports: 500 calls/day → insufficient
- Premium baseline: $500/mo for >2k unique URLs/day

## WhoisXML API Cost Management

**Pricing:**
- Free: 500 requests/month
- Paid: $0.002 per request (~$2 per 1,000)

**Quota Tracking:**
- Gauge: `wbscanner_api_quota_remaining{service="whoisxml"}`
- Alert at 80% consumption (100 remaining)
- Auto-disable and circuit breaker when exhausted

**Monthly Budget Scenarios:**

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
