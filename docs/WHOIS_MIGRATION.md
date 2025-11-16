# WHOIS Service Migration Guide

## Overview

This guide covers the migration from WhoisXML API to a self-hosted Who-dat WHOIS solution, providing quota-free domain intelligence lookups.

## What Changed

### Before
- **WhoisXML API**: External paid service with monthly quota limits (500 requests/month default)
- **Cost**: $0.005-0.01 per lookup depending on plan
- **Limitations**: Quota exhaustion, rate limiting, external dependency

### After
- **Who-dat**: Self-hosted WHOIS service running in Docker
- **Cost**: Free, no quota limits
- **Benefits**: Unlimited lookups, faster response times, no external dependencies
- **Fallback**: WhoisXML still available as fallback if who-dat fails

## Architecture

```
┌─────────────────┐
│ Scan Orchestrator│
└────────┬────────┘
         │
         ├─1─► RDAP (free, fast)
         │
         ├─2─► Who-dat (self-hosted, unlimited)
         │     └─► whois.verisign-grs.com
         │
         └─3─► WhoisXML API (fallback, quota-limited)
```

The system tries each source in order:
1. **RDAP**: Free IANA service, tried first
2. **Who-dat**: Self-hosted service with caching
3. **WhoisXML**: External API as last resort (if enabled)

## Configuration

### Environment Variables

```bash
# Self-hosted Who-dat (recommended)
WHODAT_ENABLED=true
WHODAT_BASE_URL=http://who-dat:8080
WHODAT_TIMEOUT_MS=5000

# WhoisXML API (optional fallback)
WHOISXML_ENABLE=false
WHOISXML_API_KEY=your_key_here
WHOISXML_TIMEOUT_MS=5000
WHOISXML_MONTHLY_QUOTA=500
WHOISXML_QUOTA_ALERT_THRESHOLD=100
```

### Docker Compose

The `who-dat` service is automatically included in `docker-compose.yml`:

```yaml
who-dat:
  image: carlosabalde/who-dat:latest
  environment:
    - WHO_DAT_WHOIS_SERVER=whois.verisign-grs.com
    - WHO_DAT_CACHE_ENABLED=true
    - WHO_DAT_CACHE_TTL=3600
  networks: [internal]
  restart: unless-stopped
```

## Migration Steps

### 1. Update Configuration

Edit your `.env` file:

```bash
# Enable who-dat
WHODAT_ENABLED=true

# Optionally disable WhoisXML to save costs
WHOISXML_ENABLE=false
```

### 2. Restart Services

```bash
make down
make up
```

### 3. Verify Operation

Check the logs:

```bash
make logs service=who-dat
make logs service=scan-orchestrator
```

Look for successful who-dat lookups:
```
{"level":"debug","msg":"Who-dat lookup completed","domain":"example.com","latency":234,"ageDays":5432}
```

### 4. Monitor Metrics

Access Prometheus metrics at `http://localhost:9090` or Uptime Kuma at `http://localhost:3001`:

- `wbscanner_whois_requests_total`: Total WHOIS lookups
- `wbscanner_whois_results_total{result="success"}`: Successful lookups
- `wbscanner_external_latency_seconds{service="whodat"}`: Response times

## Troubleshooting

### Who-dat Service Not Starting

Check if the service is healthy:
```bash
docker-compose ps who-dat
docker-compose logs who-dat
```

Common issues:
- Port 8080 already in use
- Network connectivity to WHOIS servers
- DNS resolution problems

### Fallback to WhoisXML

If who-dat fails, the system automatically falls back to WhoisXML (if enabled). Check logs:

```
{"level":"warn","msg":"Who-dat lookup failed, falling back to WhoisXML if available"}
```

### High Latency

Who-dat includes built-in caching (1 hour TTL). First lookups may be slower but subsequent ones are instant.

To adjust cache TTL:
```yaml
environment:
  - WHO_DAT_CACHE_TTL=7200  # 2 hours
```

## Cost Savings

### Before (WhoisXML)
- Monthly quota: 500 requests
- Cost per request: ~$0.01
- Monthly cost: ~$5
- Overage: Additional charges

### After (Who-dat)
- Unlimited requests
- Self-hosted: Infrastructure cost only
- No overage charges
- Typical savings: $60-120/year

## Performance Comparison

| Metric | WhoisXML | Who-dat |
|--------|----------|---------|
| Average latency | 200-500ms | 100-300ms (first), <10ms (cached) |
| Rate limits | Yes (varies by plan) | No |
| Monthly quota | 500-10,000 | Unlimited |
| Caching | Server-side | Local + server-side |
| Availability | 99.9% SLA | Self-managed |

## Rollback Plan

To revert to WhoisXML-only:

1. Edit `.env`:
```bash
WHODAT_ENABLED=false
WHOISXML_ENABLE=true
```

2. Restart:
```bash
make down
make up
```

The system will skip who-dat and use WhoisXML directly.

## Best Practices

1. **Keep WhoisXML as Fallback**: Enable it with a small quota for redundancy
2. **Monitor Cache Hit Rate**: Track `wbscanner_cache_hit_ratio{cache_type="whois_analysis"}`
3. **Set Appropriate Timeouts**: Balance between reliability and speed
4. **Regular Health Checks**: Monitor who-dat service health
5. **Log Analysis**: Review logs for failed lookups and adjust configuration

## Support

For issues or questions:
- Check logs: `make logs`
- Review metrics: Prometheus at `http://localhost:9090`
- Monitor services: Uptime Kuma at `http://localhost:3001`
- GitHub Issues: Report bugs or feature requests