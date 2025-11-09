# Enhanced Security Features

_Last updated: November 9, 2025_

## Overview

The Enhanced Security system provides zero-cost, API-independent threat intelligence that operates as a first-line defense before querying rate-limited external services. It implements a tiered analysis approach optimized for sub-second performance while maintaining human-like behavior patterns to avoid detection/blocking.

## Architecture

### Tiered Execution Model

```
URL Scan Request
    ↓
┌─────────────────────────────────────────┐
│ TIER 1: Instant Local Checks (<500ms)  │
│ - Advanced Heuristics (entropy, patterns)│
│ - DNS Intelligence (DNSBL, DNSSEC, flux)│
│ - Local Threat DB (OpenPhish, collab)  │
└─────────────────────────────────────────┘
    ↓
Score > 2.0? → YES → Malicious (High Confidence)
    ↓ NO                    ↓ Skip External APIs
┌─────────────────────────────────────────┐
│ TIER 2: Fast External Checks (<2s)     │
│ - Certificate Intelligence (TLS, CT)    │
│ - HTTP Fingerprinting (headers, redir) │
└─────────────────────────────────────────┘
    ↓
Score > 1.5? → YES → Suspicious (Medium Confidence)
    ↓ NO                    ↓ Continue to APIs
┌─────────────────────────────────────────┐
│ TIER 3: External API Checks             │
│ - Google Safe Browsing                  │
│ - VirusTotal                            │
│ - URLhaus, Phishtank, etc.              │
└─────────────────────────────────────────┘
```

## Modules

### 1. DNS Intelligence (`dns-intelligence.ts`)

**Purpose:** Detect malicious domains through DNS-based threat intelligence.

**Features:**
- **DNSBL Queries:** Parallel queries to Spamhaus ZEN, SURBL, URIBL, Spamhaus DBL
- **DNSSEC Validation:** Checks for missing/invalid DNSSEC records
- **Fast-Flux Detection:** Identifies networks with 5+ A records and TTL < 300s

**Configuration:**
```bash
DNSBL_ENABLED=true
DNSBL_TIMEOUT_MS=2000
```

**Scoring:**
- DNSBL hit: +0.8 to +0.9 (weighted by provider)
- Missing DNSSEC: +0.3
- Fast-flux detected: +0.5

**Caching:**
- Benign results: 6 hours
- Listed results: 30 minutes

**Metrics:**
- `dnsbl_queries_total{provider, result}`
- `dnsbl_hits_total{provider}`
- `dnsbl_latency_seconds{provider}`
- `dnssec_validation_total{result}`
- `fast_flux_detection_total{detected}`

### 2. Certificate Intelligence (`certificate-intelligence.ts`)

**Purpose:** Analyze TLS certificates for suspicious indicators.

**Features:**
- **Self-Signed Detection:** Identifies certificates signed by themselves
- **Certificate Age:** Flags newly issued certificates (<7 days, <30 days)
- **SAN Analysis:** Detects excessive Subject Alternative Names (>10)
- **Chain Validation:** Verifies certificate chain integrity
- **CT Log Presence:** Checks Certificate Transparency logs via crt.sh

**Configuration:**
```bash
CERT_INTEL_ENABLED=true
CERT_INTEL_TIMEOUT_MS=3000
CERT_INTEL_CT_CHECK_ENABLED=true
```

**Scoring:**
- Self-signed: +0.8
- Age < 7 days: +0.4
- Age < 30 days: +0.2
- SAN count > 10: +0.3
- Invalid chain: +0.5
- Missing from CT logs: +0.3
- Expired: +0.9

**Caching:**
- Valid certificates: 7 days
- Suspicious certificates: 1 hour

**Metrics:**
- `cert_analysis_total{result}`
- `cert_suspicious_total{reason}`
- `cert_analysis_latency_seconds`

### 3. Advanced Heuristics (`advanced-heuristics.ts`)

**Purpose:** Detect suspicious URL patterns through entropy and pattern analysis.

**Features:**
- **Shannon Entropy:** Calculates randomness in hostnames and paths
- **Keyboard Walk Detection:** Identifies patterns like "qwerty", "asdf"
- **Subdomain Analysis:** Counts subdomains, depth, numeric patterns
- **Pattern Matching:** Detects compromised WordPress, phishing pages, open redirects

**Configuration:**
```bash
ENHANCED_HEURISTICS_ENTROPY_THRESHOLD=4.5
```

**Scoring:**
- Hostname entropy > 4.5: +0.3
- Path entropy > 5.0: +0.2
- Excessive numbers (>50%): +0.2
- Keyboard walks: +0.2
- Subdomain count > 5: +0.2
- Numeric subdomains: +0.1
- Deep nesting (>4 levels): +0.15
- Each suspicious pattern: +0.15

**Suspicious Patterns:**
- `/wp-(admin|login|content)/[a-z0-9]{20,}` - Compromised WordPress
- `/(login|signin|account).*\d{10,}` - Fake login with session
- `/verify.*account.*[a-z0-9]{30,}` - Phishing verify
- `\.(php|asp|jsp)\?.*=.*http` - Open redirect
- IP addresses in URL
- Brand impersonation (paypal, amazon, apple, etc.)

**Metrics:**
- `heuristic_detection_total{type}`

### 4. Local Threat Database (`local-threat-db.ts`)

**Purpose:** Maintain local threat intelligence with OpenPhish integration and collaborative learning.

**Features:**
- **OpenPhish Feed:** Updates every 2 hours from https://openphish.com/feed.txt
- **Exact URL Matching:** Immediate detection of known phishing URLs
- **Domain Matching:** Flags domains with multiple phishing entries
- **Collaborative Learning:** Auto-flags URLs after 3+ malicious reports in 7 days
- **Historical Verdicts:** Stores 90 days of verdict history with exponential decay

**Configuration:**
```bash
LOCAL_THREAT_DB_ENABLED=true
OPENPHISH_FEED_URL=https://openphish.com/feed.txt
OPENPHISH_UPDATE_INTERVAL_MS=7200000
```

**Scoring:**
- Exact URL match: +0.9
- Domain match: +0.4
- Collaborative auto-flag: +0.7

**Storage:**
- Redis keys: `threat:feed:{hash}`, `threat:domain:{domain}`, `threat:collaborative:{hash}`
- TTL: 24 hours (feed), 90 days (collaborative)

**Metrics:**
- `threat_feed_update_total{source, result}`
- `threat_feed_entries{source}`
- `local_threat_hits_total{match_type}`
- `collaborative_learning_total{action}`

**Admin Commands:**
- `!scanner updatefeeds` - Manually trigger feed update

### 5. HTTP Fingerprinting (`http-fingerprint.ts`)

**Purpose:** Analyze HTTP responses for suspicious indicators.

**Features:**
- **Security Headers:** Checks HSTS, CSP, X-Frame-Options, X-Content-Type-Options
- **Server Header Analysis:** Detects compromised CMS versions
- **Redirect Analysis:** Identifies cross-domain redirects
- **Status Code Anomalies:** Flags 404 with redirects
- **Human-Like Behavior:** Random user agents, jitter delays (100-500ms)
- **Connection Pooling:** Reuses HTTPS connections for performance

**Configuration:**
```bash
HTTP_FINGERPRINT_ENABLED=true
HTTP_FINGERPRINT_TIMEOUT_MS=2000
```

**Scoring:**
- All security headers missing: +0.2
- Compromised CMS: +0.3
- Cross-domain redirect: +0.4
- 404 with redirect: +0.5

**Caching:**
- Benign responses: 24 hours
- Suspicious responses: 1 hour

**Metrics:**
- `http_fingerprint_total{result}`
- `http_fingerprint_suspicious_total{reason}`
- `http_fingerprint_latency_seconds`

## Integration

### Scan Orchestrator Integration

The `EnhancedSecurityAnalyzer` class (`services/scan-orchestrator/src/enhanced-security.ts`) orchestrates all modules:

```typescript
const analyzer = new EnhancedSecurityAnalyzer(redis);
await analyzer.start(); // Starts OpenPhish feed updates

const result = await analyzer.analyze(finalUrl, hash);

if (result.verdict === 'malicious' && result.confidence === 'high') {
  // Skip external APIs, return verdict immediately
  return result;
}

// Continue to external API checks...
```

### Verdict Recording

All scan verdicts are recorded for collaborative learning:

```typescript
await analyzer.recordVerdict(url, 'malicious', 0.9);
```

After 3+ malicious reports in 7 days, the URL is auto-flagged on subsequent scans.

## Performance Characteristics

### Latency Targets

- **Tier 1 (p95):** <500ms
- **Tier 2 (p95):** <2s
- **Full scan (p95):** <3s

### API Call Reduction

Expected reduction in external API calls: **30-40%**

### Cache Hit Ratios

After 24-hour warmup:
- DNS Intelligence: 60-70%
- Certificate Intelligence: 50-60%
- HTTP Fingerprinting: 40-50%
- Local Threat DB: 70-80%

## Metrics

### Enhanced Security Metrics

```prometheus
# Score distribution
enhanced_security_score

# Tier 1 blocks (high-confidence threats)
tier1_blocks_total

# API calls avoided
api_calls_avoided_total

# Latency by tier
enhanced_security_latency_seconds{tier="tier1|tier2"}
```

### Module-Specific Metrics

See individual module sections above for detailed metrics.

## Configuration Reference

### Environment Variables

```bash
# Master switch
ENHANCED_SECURITY_ENABLED=true

# DNS Intelligence
DNSBL_ENABLED=true
DNSBL_TIMEOUT_MS=2000

# Certificate Intelligence
CERT_INTEL_ENABLED=true
CERT_INTEL_TIMEOUT_MS=3000
CERT_INTEL_CT_CHECK_ENABLED=true

# Local Threat Database
LOCAL_THREAT_DB_ENABLED=true
OPENPHISH_FEED_URL=https://openphish.com/feed.txt
OPENPHISH_UPDATE_INTERVAL_MS=7200000

# HTTP Fingerprinting
HTTP_FINGERPRINT_ENABLED=true
HTTP_FINGERPRINT_TIMEOUT_MS=2000

# Advanced Heuristics
ENHANCED_HEURISTICS_ENTROPY_THRESHOLD=4.5
```

### Feature Flags

All modules can be independently disabled by setting their `*_ENABLED` flag to `false`. The system gracefully degrades when modules are disabled.

## Monitoring

### Grafana Dashboards

Enhanced security metrics are exposed in the following panels:

1. **Enhanced Security Overview**
   - Tier 1/2 latency histograms
   - API call reduction rate
   - Score distribution

2. **DNS Intelligence**
   - DNSBL query rates and hit rates by provider
   - DNSSEC validation success rate
   - Fast-flux detection rate

3. **Certificate Intelligence**
   - Analysis success rate
   - Suspicious certificate reasons
   - CT log check success rate

4. **Local Threat Database**
   - Feed update status
   - Entry counts by source
   - Collaborative learning auto-flags

5. **HTTP Fingerprinting**
   - Request success rate
   - Security header coverage
   - Suspicious redirect detection

### Alerts

Recommended alert thresholds:

- `tier1_blocks_total` rate increase >50% (potential attack wave)
- `enhanced_security_latency_seconds{tier="tier1"}` p95 >1s (performance degradation)
- `threat_feed_update_total{result="error"}` >3 in 1h (feed update failures)
- `dnsbl_queries_total{result="timeout"}` rate >20% (DNS issues)

## Testing

### Unit Tests

Located in `packages/shared/__tests__/reputation/`:
- `dns-intelligence.test.ts`
- `certificate-intelligence.test.ts`
- `advanced-heuristics.test.ts`
- `local-threat-db.test.ts`
- `http-fingerprint.test.ts`

Run with: `npm test --workspace @wbscanner/shared`

### Integration Tests

Located in `tests/integration/enhanced-security.test.ts`

Run with: `npm run test:integration`

### Load Tests

Simulate 100 concurrent scans:

```bash
npm run test:load
```

## Security Considerations

### SSRF Protection

HTTP fingerprinting enforces SSRF guards via `assertSafeUrl` to prevent scanning internal networks.

### Rate Limiting

- DNS queries: 2s timeout per provider
- Certificate fetches: 3s timeout
- HTTP requests: 2s timeout
- Human-like delays: 100-500ms jitter

### Privacy

- No URL content is logged, only hashes and metadata
- User agents are rotated to avoid fingerprinting
- All external requests use TLS where possible

## Troubleshooting

### High Tier 1 Latency

Check:
1. DNS resolver performance (`dig @8.8.8.8 example.com`)
2. Redis connection pool exhaustion
3. DNSBL provider timeouts

### Low Cache Hit Ratios

Check:
1. Redis memory limits
2. Cache TTL configuration
3. URL normalization consistency

### Feed Update Failures

Check:
1. OpenPhish feed availability
2. Network egress rules
3. Redis write permissions

## Future Enhancements

Planned improvements:
- Machine learning model for entropy threshold tuning
- Additional DNSBL providers (Barracuda, SORBS)
- WHOIS-based domain registration analysis
- JavaScript execution fingerprinting
- Passive DNS integration
