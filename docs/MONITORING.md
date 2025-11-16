# Monitoring Guide

## Overview

The WhatsApp Bot Scanner uses a multi-layered monitoring approach combining Prometheus metrics with Uptime Kuma for easy GUI-based monitoring and alerting.

## Monitoring Stack

### 1. Prometheus
- **Purpose**: Metrics collection and storage
- **Access**: Internal only (no exposed port by default)
- **Data**: Time-series metrics from all services

### 2. Uptime Kuma
- **Purpose**: GUI dashboard, uptime monitoring, and alerting
- **Access**: `http://localhost:3001`
- **Features**: 
  - Service health monitoring
  - Response time tracking
  - Alert notifications (email, Slack, Discord, etc.)
  - Status pages
  - Multi-user support

## Quick Start

### 1. Start Monitoring Services

```bash
make up
```

This starts:
- Prometheus (internal metrics collector)
- Uptime Kuma (GUI dashboard on port 3001)

### 2. Access Uptime Kuma

1. Open `http://localhost:3001` in your browser
2. Create admin account on first visit
3. Start adding monitors

### 3. Configure Monitors

#### Service Health Checks

Add these monitors in Uptime Kuma:

**Control Plane**
- Type: HTTP(s)
- URL: `http://control-plane:8080/healthz`
- Interval: 60 seconds
- Headers: `Authorization: Bearer ${CONTROL_PLANE_API_TOKEN}`

**Scan Orchestrator**
- Type: HTTP(s)
- URL: `http://scan-orchestrator:3001/healthz`
- Interval: 60 seconds

**WA Client**
- Type: HTTP(s)
- URL: `http://wa-client:3000/healthz`
- Interval: 60 seconds

**Who-dat WHOIS**
- Type: HTTP(s)
- URL: `http://who-dat:8080/health`
- Interval: 120 seconds

**Redis**
- Type: TCP Port
- Hostname: redis
- Port: 6379
- Interval: 60 seconds

**PostgreSQL**
- Type: TCP Port
- Hostname: postgres
- Port: 5432
- Interval: 60 seconds

#### External Services

**URLScan.io**
- Type: HTTP(s)
- URL: `https://urlscan.io/api/v1/`
- Interval: 300 seconds

**VirusTotal**
- Type: HTTP(s)
- URL: `https://www.virustotal.com/api/v3/`
- Interval: 300 seconds

## Metrics Available

### Service Metrics

All services expose metrics at `/metrics`:
- Control Plane: `http://control-plane:8080/metrics`
- Scan Orchestrator: `http://scan-orchestrator:3001/metrics`
- WA Client: `http://wa-client:3000/metrics`

### Key Metrics

#### Scan Performance
- `wbscanner_scan_latency_seconds`: Time to complete scans
- `wbscanner_verdict_latency_seconds`: Time from ingestion to verdict
- `wbscanner_verdict_counter{verdict}`: Count by verdict type

#### Queue Health
- `wbscanner_queue_depth{queue}`: Jobs waiting
- `wbscanner_queue_active{queue}`: Jobs processing
- `wbscanner_queue_processing_duration_seconds{queue}`: Processing time

#### External APIs
- `wbscanner_external_latency_seconds{service}`: API response times
- `wbscanner_external_errors_total{service,reason}`: API errors
- `wbscanner_circuit_breaker_state{service}`: Circuit breaker status

#### WHOIS Services
- `wbscanner_whois_requests_total`: Total WHOIS lookups
- `wbscanner_whois_results_total{result}`: Outcomes (success/error)
- `wbscanner_api_quota_remaining{service}`: Remaining quota

#### Cache Performance
- `wbscanner_cache_hit_ratio{cache_type}`: Hit rate by cache type
- `wbscanner_cache_entry_ttl_seconds{cache_type}`: TTL values

## Alerting

### Configure Notifications in Uptime Kuma

1. Go to Settings → Notifications
2. Add notification channels:
   - Email (SMTP)
   - Slack
   - Discord
   - Telegram
   - PagerDuty
   - And many more...

### Recommended Alerts

#### Critical
- Any service down for > 2 minutes
- PostgreSQL connection failures
- Redis connection failures

#### Warning
- Response time > 5 seconds
- Queue depth > 100
- Circuit breaker open
- WHOIS quota < 20%

#### Info
- Service restarts
- Configuration changes
- Scheduled maintenance

### Alert Configuration Example

**Service Down Alert**
```yaml
Monitor: Control Plane
Notification: Slack
Conditions:
  - Status: Down
  - Duration: 2 minutes
Message: "🚨 Control Plane is DOWN! Immediate attention required."
```

**High Latency Warning**
```yaml
Monitor: Scan Orchestrator
Notification: Email
Conditions:
  - Response Time: > 5000ms
  - Duration: 5 minutes
Message: "⚠️ Scan Orchestrator latency is high. Check system load."
```

## Status Pages

Uptime Kuma can generate public status pages:

1. Go to Status Pages
2. Create new status page
3. Add monitors to display
4. Configure public URL
5. Share with stakeholders

## Dashboards

### Uptime Kuma Dashboard

Default view shows:
- Service status grid
- Response time graphs
- Uptime percentages
- Recent events

### Custom Views

Create custom views for:
- Production services only
- External dependencies
- Critical path services
- Development environment

## Prometheus Queries

Access Prometheus directly at `http://prometheus:9090` (internal network):

### Useful Queries

**Average scan latency (last 5m)**
```promql
rate(wbscanner_scan_latency_seconds_sum[5m]) / rate(wbscanner_scan_latency_seconds_count[5m])
```

**Verdict distribution**
```promql
sum by (verdict) (rate(wbscanner_verdict_counter[5m]))
```

**Queue backlog**
```promql
sum by (queue) (wbscanner_queue_depth)
```

**Circuit breaker status**
```promql
wbscanner_circuit_breaker_state{service="whodat"}
```

**Cache hit rate**
```promql
wbscanner_cache_hit_ratio{cache_type="whois_analysis"}
```

## Troubleshooting

### Uptime Kuma Not Accessible

1. Check if service is running:
```bash
docker-compose ps uptime-kuma
```

2. Check logs:
```bash
docker-compose logs uptime-kuma
```

3. Verify port mapping:
```bash
docker-compose port uptime-kuma 3001
```

### Monitors Showing False Positives

- Increase check interval for flaky services
- Adjust timeout values
- Add retry logic
- Check network connectivity

### Missing Metrics

1. Verify service is exposing `/metrics`
2. Check Prometheus configuration
3. Ensure services are in same network
4. Review firewall rules

## Best Practices

### Monitor Configuration
1. **Start Simple**: Add core services first
2. **Tune Intervals**: Balance between accuracy and load
3. **Set Realistic Thresholds**: Avoid alert fatigue
4. **Document Changes**: Track monitor configurations

### Alert Management
1. **Prioritize Alerts**: Critical vs warning vs info
2. **Group Related Alerts**: Avoid duplicate notifications
3. **Set Escalation Policies**: Who gets notified when
4. **Regular Review**: Adjust thresholds based on patterns

### Maintenance
1. **Regular Backups**: Export Uptime Kuma configuration
2. **Update Monitors**: Keep in sync with infrastructure changes
3. **Review Metrics**: Identify trends and optimize
4. **Clean Up**: Remove obsolete monitors

## Migration from Grafana

### What Changed

**Before (Grafana)**
- Complex dashboard setup
- Requires manual configuration
- Separate alerting setup
- Limited notification channels

**After (Uptime Kuma)**
- Simple GUI setup
- Auto-discovery friendly
- Built-in alerting
- 90+ notification integrations
- Status page generation
- Mobile app available

### Migration Steps

1. **Export Grafana Dashboards**: Document current panels
2. **Create Equivalent Monitors**: Add to Uptime Kuma
3. **Configure Notifications**: Set up alert channels
4. **Test Thoroughly**: Verify all monitors work
5. **Update Documentation**: Reflect new URLs and processes

### Keeping Prometheus

Prometheus is still running and collecting metrics. You can:
- Query metrics directly via Prometheus UI
- Use for long-term metric storage
- Integrate with other tools if needed
- Export to other monitoring systems

## Support and Resources

### Documentation
- Uptime Kuma: https://github.com/louislam/uptime-kuma
- Prometheus: https://prometheus.io/docs/

### Getting Help
- Check service logs: `make logs`
- Review metrics: Access Prometheus at internal port
- Test monitors: Use Uptime Kuma's test feature
- Community: GitHub discussions and issues