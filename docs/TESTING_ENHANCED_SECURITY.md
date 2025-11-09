# Testing Enhanced Security Features

This guide provides comprehensive testing procedures for the enhanced security system.

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ installed
- Access to test environment
- Test URLs (benign and malicious samples)

## Quick Start

```bash
# 1. Build and start the stack
make build
make up

# 2. Verify enhanced security started
make logs | grep "Enhanced security analyzer started"

# 3. Run unit tests
npm test --workspace @wbscanner/shared

# 4. Run integration tests
npm run test:integration

# 5. View metrics
curl http://localhost:9090/metrics | grep enhanced_security
```

## Unit Testing

### Running Unit Tests

```bash
# All enhanced security tests
npm test --workspace @wbscanner/shared -- --testPathPattern=reputation

# Specific module tests
npm test --workspace @wbscanner/shared -- dns-intelligence.test.ts
npm test --workspace @wbscanner/shared -- certificate-intelligence.test.ts
npm test --workspace @wbscanner/shared -- advanced-heuristics.test.ts
npm test --workspace @wbscanner/shared -- local-threat-db.test.ts
npm test --workspace @wbscanner/shared -- http-fingerprint.test.ts

# With coverage
npm test --workspace @wbscanner/shared -- --coverage
```

### Expected Results

All tests should pass with >85% coverage:

```
PASS  packages/shared/__tests__/reputation/dns-intelligence.test.ts
PASS  packages/shared/__tests__/reputation/certificate-intelligence.test.ts
PASS  packages/shared/__tests__/reputation/advanced-heuristics.test.ts
PASS  packages/shared/__tests__/reputation/local-threat-db.test.ts
PASS  packages/shared/__tests__/reputation/http-fingerprint.test.ts

Test Suites: 5 passed, 5 total
Tests:       50 passed, 50 total
Coverage:    89.2%
```

## Integration Testing

### Running Integration Tests

```bash
# All integration tests
npm run test:integration

# Enhanced security specific
npm run test:integration -- enhanced-security.test.ts

# With verbose output
npm run test:integration -- --verbose
```

### Test Scenarios

1. **Tier 1 High-Confidence Block**
   - URL with high entropy + DNSBL hit
   - Expected: Malicious verdict, skip external APIs
   - Metric: `tier1_blocks_total` increments

2. **OpenPhish Feed Hit**
   - URL in OpenPhish feed
   - Expected: Exact match, high score
   - Metric: `local_threat_hits_total{match_type="exact"}` increments

3. **Collaborative Learning**
   - Record 3+ malicious verdicts
   - Expected: Auto-flag on subsequent scan
   - Metric: `collaborative_learning_total{action="auto_flagged"}` increments

4. **Certificate Analysis**
   - Self-signed certificate
   - Expected: Suspicious score increase
   - Metric: `cert_suspicious_total{reason="self_signed"}` increments

5. **HTTP Fingerprinting**
   - Missing security headers
   - Expected: Score increase
   - Metric: `http_fingerprint_suspicious_total{reason="no_security_headers"}` increments

6. **Performance Benchmark**
   - 100 concurrent scans
   - Expected: Complete in <15s, p99 <3s
   - Metric: `enhanced_security_latency_seconds` within targets

## Manual Testing

### Test URLs

#### Benign URLs (Should NOT trigger)
```bash
# Google
curl -X POST http://localhost:8080/rescan \
  -H "Authorization: Bearer $CONTROL_PLANE_API_TOKEN" \
  -d '{"url": "https://www.google.com"}'

# GitHub
curl -X POST http://localhost:8080/rescan \
  -H "Authorization: Bearer $CONTROL_PLANE_API_TOKEN" \
  -d '{"url": "https://github.com"}'

# Wikipedia
curl -X POST http://localhost:8080/rescan \
  -H "Authorization: Bearer $CONTROL_PLANE_API_TOKEN" \
  -d '{"url": "https://en.wikipedia.org"}'
```

Expected: `verdict: "benign"`, no enhanced security reasons

#### Suspicious URLs (Should trigger Tier 2)
```bash
# High entropy subdomain
curl -X POST http://localhost:8080/rescan \
  -H "Authorization: Bearer $CONTROL_PLANE_API_TOKEN" \
  -d '{"url": "https://xk7j9m2n4p8q1r5s.example.com"}'

# Excessive subdomains
curl -X POST http://localhost:8080/rescan \
  -H "Authorization: Bearer $CONTROL_PLANE_API_TOKEN" \
  -d '{"url": "https://a.b.c.d.e.f.example.com"}'

# Suspicious pattern
curl -X POST http://localhost:8080/rescan \
  -H "Authorization: Bearer $CONTROL_PLANE_API_TOKEN" \
  -d '{"url": "https://example.com/wp-admin/abcdefghijklmnopqrstuvwxyz123456"}'
```

Expected: `verdict: "suspicious"`, enhanced security reasons present

#### Malicious URLs (Should trigger Tier 1)
```bash
# Known phishing (if in OpenPhish feed)
curl -X POST http://localhost:8080/rescan \
  -H "Authorization: Bearer $CONTROL_PLANE_API_TOKEN" \
  -d '{"url": "http://known-phishing-site.example.com"}'

# Multiple suspicious indicators
curl -X POST http://localhost:8080/rescan \
  -H "Authorization: Bearer $CONTROL_PLANE_API_TOKEN" \
  -d '{"url": "https://xk7j9m2n4p8q1r5s.suspicious-tld.xyz/verify-account-abcdefghijklmnopqrstuvwxyz"}'
```

Expected: `verdict: "malicious"`, high score, Tier 1 block

### Verifying Results

```bash
# Check scan result
curl http://localhost:8080/scans/{url_hash} \
  -H "Authorization: Bearer $CONTROL_PLANE_API_TOKEN"

# Check metrics
curl http://localhost:9090/metrics | grep -E "tier1_blocks|api_calls_avoided|enhanced_security_score"

# Check Redis cache
docker exec -it wbscanner-redis redis-cli KEYS "threat:*"

# Check logs
make logs | grep -E "Tier 1|Enhanced security"
```

## Load Testing

### Basic Load Test

```bash
# 100 concurrent scans
npm run test:load

# Custom load test
LOAD_CONCURRENCY=200 LOAD_DURATION_SECONDS=60 npm run test:load
```

### Expected Performance

| Metric | Target | Acceptable |
|--------|--------|------------|
| Tier 1 p50 | <200ms | <300ms |
| Tier 1 p95 | <500ms | <700ms |
| Tier 2 p50 | <1s | <1.5s |
| Tier 2 p95 | <2s | <3s |
| Full scan p95 | <3s | <5s |
| API reduction | >30% | >20% |

### Monitoring During Load Test

```bash
# Watch metrics in real-time
watch -n 1 'curl -s http://localhost:9090/metrics | grep -E "enhanced_security_latency|tier1_blocks|api_calls_avoided"'

# Monitor queue depth
watch -n 1 'curl -s http://localhost:9090/metrics | grep queue_depth'

# Check Redis memory
docker exec -it wbscanner-redis redis-cli INFO memory
```

## Monitoring Procedures

### 48-Hour Monitoring Checklist

#### Hour 0-1: Initial Deployment
- [ ] All services started successfully
- [ ] Enhanced security analyzer started
- [ ] OpenPhish feed loaded (>1000 entries)
- [ ] Metrics exposed on /metrics endpoint
- [ ] Grafana dashboard accessible
- [ ] No error logs

#### Hour 1-6: Warmup Period
- [ ] Cache hit ratio increasing
- [ ] Tier 1 blocks occurring
- [ ] API calls being avoided
- [ ] No memory leaks (stable RSS)
- [ ] No circuit breakers open
- [ ] Feed updates successful

#### Hour 6-24: Steady State
- [ ] Cache hit ratio >50%
- [ ] API reduction >20%
- [ ] Tier 1 latency p95 <500ms
- [ ] No false positives reported
- [ ] Collaborative learning working
- [ ] All metrics within targets

#### Hour 24-48: Long-term Stability
- [ ] Cache hit ratio >60%
- [ ] API reduction >30%
- [ ] Memory usage stable
- [ ] No degraded mode events
- [ ] Feed updates consistent
- [ ] Zero production incidents

### Key Metrics to Monitor

#### Performance Metrics

```promql
# Tier 1 latency (target: <500ms p95)
histogram_quantile(0.95, sum(rate(enhanced_security_latency_seconds_bucket{tier="tier1"}[5m])) by (le))

# Tier 2 latency (target: <2s p95)
histogram_quantile(0.95, sum(rate(enhanced_security_latency_seconds_bucket{tier="tier2"}[5m])) by (le))

# API call reduction rate (target: >30%)
sum(rate(api_calls_avoided_total[5m])) / (sum(rate(api_calls_avoided_total[5m])) + sum(rate(wbscanner_external_api_calls_total[5m]))) * 100
```

#### Reliability Metrics

```promql
# DNSBL timeout rate (alert if >20%)
rate(dnsbl_queries_total{result="timeout"}[5m]) / rate(dnsbl_queries_total[5m])

# Certificate analysis error rate (alert if >10%)
rate(cert_analysis_total{result="error"}[5m]) / rate(cert_analysis_total[5m])

# Feed update failures (alert if >3 in 1h)
increase(threat_feed_update_total{result="error"}[1h])
```

#### Effectiveness Metrics

```promql
# Tier 1 block rate
rate(tier1_blocks_total[5m])

# Collaborative learning auto-flags
rate(collaborative_learning_total{action="auto_flagged"}[5m])

# Local threat hits by type
sum(rate(local_threat_hits_total[5m])) by (match_type)
```

### Alert Thresholds

#### Critical Alerts

```yaml
- alert: EnhancedSecurityDown
  expr: up{job="scan-orchestrator"} == 0
  for: 1m
  severity: critical

- alert: ThreatFeedStale
  expr: time() - threat_feed_last_update_timestamp > 7200
  for: 5m
  severity: critical
```

#### Warning Alerts

```yaml
- alert: HighTier1Latency
  expr: histogram_quantile(0.95, rate(enhanced_security_latency_seconds_bucket{tier="tier1"}[5m])) > 1
  for: 5m
  severity: warning

- alert: DNSBLTimeoutHigh
  expr: rate(dnsbl_queries_total{result="timeout"}[5m]) / rate(dnsbl_queries_total[5m]) > 0.2
  for: 5m
  severity: warning

- alert: LowCacheHitRatio
  expr: sum(rate(wbscanner_cache_hits_total[5m])) / sum(rate(wbscanner_cache_lookups_total[5m])) < 0.4
  for: 15m
  severity: warning
```

## Troubleshooting

### High Tier 1 Latency

**Symptoms:** `enhanced_security_latency_seconds{tier="tier1"}` p95 >1s

**Diagnosis:**
```bash
# Check DNS resolver performance
dig @8.8.8.8 example.com

# Check DNSBL provider latency
for provider in zen.spamhaus.org multi.surbl.org multi.uribl.com dbl.spamhaus.org; do
  echo "Testing $provider"
  time dig @8.8.8.8 test.$provider
done

# Check Redis latency
docker exec -it wbscanner-redis redis-cli --latency

# Check system load
docker stats
```

**Solutions:**
- Increase DNSBL timeout: `DNSBL_TIMEOUT_MS=3000`
- Disable slow providers temporarily
- Scale Redis if needed
- Check network connectivity

### Low Cache Hit Ratio

**Symptoms:** Cache hit ratio <40% after 24h

**Diagnosis:**
```bash
# Check Redis memory
docker exec -it wbscanner-redis redis-cli INFO memory

# Check cache keys
docker exec -it wbscanner-redis redis-cli KEYS "*" | wc -l

# Check TTL distribution
docker exec -it wbscanner-redis redis-cli --scan --pattern "scan:*" | xargs -I {} redis-cli TTL {}
```

**Solutions:**
- Increase Redis memory limit
- Adjust cache TTLs in config
- Check for cache eviction
- Verify URL normalization consistency

### Feed Update Failures

**Symptoms:** `threat_feed_update_total{result="error"}` increasing

**Diagnosis:**
```bash
# Test OpenPhish feed manually
curl -I https://openphish.com/feed.txt

# Check logs
make logs | grep "OpenPhish feed"

# Check Redis write permissions
docker exec -it wbscanner-redis redis-cli SET test_key test_value
```

**Solutions:**
- Verify network egress rules
- Check OpenPhish availability
- Increase update interval if rate-limited
- Verify Redis write permissions

### False Positives

**Symptoms:** Benign URLs flagged as malicious

**Diagnosis:**
```bash
# Check which module triggered
curl http://localhost:8080/scans/{url_hash} \
  -H "Authorization: Bearer $CONTROL_PLANE_API_TOKEN" \
  | jq '.reasons'

# Check enhanced security score breakdown
curl http://localhost:9090/metrics | grep enhanced_security_score
```

**Solutions:**
- Adjust entropy threshold: `ENHANCED_HEURISTICS_ENTROPY_THRESHOLD=5.0`
- Disable specific modules if needed
- Add to allowlist via control-plane
- Report false positive for pattern refinement

## Regression Testing

### Before Deployment

```bash
# 1. Run full test suite
npm test --workspaces

# 2. Run integration tests
npm run test:integration

# 3. Run load tests
npm run test:load

# 4. Verify no breaking changes
npm run test:fast
```

### After Deployment

```bash
# 1. Smoke test critical paths
./scripts/smoke-test.sh

# 2. Verify existing scans still work
curl http://localhost:8080/scans/{known_url_hash} \
  -H "Authorization: Bearer $CONTROL_PLANE_API_TOKEN"

# 3. Check metrics baseline
curl http://localhost:9090/metrics > metrics_baseline.txt

# 4. Monitor for 1 hour
watch -n 60 'curl -s http://localhost:9090/metrics | diff - metrics_baseline.txt'
```

## Performance Benchmarking

### Baseline Measurement

```bash
# Before enhanced security
ENHANCED_SECURITY_ENABLED=false make up
npm run test:load > baseline_results.txt

# With enhanced security
ENHANCED_SECURITY_ENABLED=true make up
npm run test:load > enhanced_results.txt

# Compare
diff baseline_results.txt enhanced_results.txt
```

### Expected Improvements

- **Latency:** 10-20% reduction for cached results
- **API calls:** 30-40% reduction
- **Throughput:** 15-25% increase due to early exits

## Continuous Monitoring

### Daily Checks

```bash
# Check feed updates
docker exec -it wbscanner-redis redis-cli KEYS "threat:feed:*" | wc -l

# Check collaborative learning entries
docker exec -it wbscanner-redis redis-cli KEYS "threat:collaborative:*" | wc -l

# Check error rates
curl -s http://localhost:9090/metrics | grep -E "_total.*error"
```

### Weekly Reviews

- Review Grafana dashboards
- Check alert history
- Analyze false positive reports
- Review performance trends
- Update threat patterns if needed

### Monthly Maintenance

- Review and update DNSBL providers
- Analyze collaborative learning effectiveness
- Optimize cache TTLs based on hit ratios
- Update suspicious patterns
- Review and tune alert thresholds

## Test Data

### Sample URLs for Testing

```bash
# Create test data file
cat > test_urls.txt <<EOF
https://www.google.com
https://github.com
https://en.wikipedia.org
https://xk7j9m2n4p8q1r5s.example.com
https://a.b.c.d.e.f.example.com
https://example.com/wp-admin/abcdefghijklmnopqrstuvwxyz123456
https://example.com/verify-account-abcdefghijklmnopqrstuvwxyz
EOF

# Test all URLs
while read url; do
  echo "Testing: $url"
  curl -X POST http://localhost:8080/rescan \
    -H "Authorization: Bearer $CONTROL_PLANE_API_TOKEN" \
    -d "{\"url\": \"$url\"}" \
    -s | jq '.verdict, .score, .reasons'
  sleep 2
done < test_urls.txt
```

## Conclusion

This testing guide provides comprehensive procedures for validating the enhanced security system. Follow these procedures during:

1. **Development:** Unit and integration tests
2. **Pre-deployment:** Load testing and benchmarking
3. **Deployment:** 48-hour monitoring
4. **Production:** Continuous monitoring and maintenance

For issues or questions, refer to:
- `docs/ENHANCED_SECURITY.md` - Feature documentation
- `docs/TROUBLESHOOTING.md` - General troubleshooting
- Grafana dashboards - Real-time metrics
- Application logs - Detailed error information
