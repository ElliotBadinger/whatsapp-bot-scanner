# DeepSource Setup Guide

This guide explains how to set up and use DeepSource code analysis for the WhatsApp Bot Scanner project, including programmatic API access.

## Overview

DeepSource provides automated code analysis for:
- **Docker**: Dockerfile and docker-compose.yml best practices
- **JavaScript/TypeScript**: Code quality, security, and performance issues
- **Code Formatting**: Automated Prettier formatting

## Initial Setup

### 1. Activate Repository on DeepSource

1. Go to the [DeepSource dashboard](https://app.deepsource.com)
2. Navigate to your repository: `ElliotBadinger/whatsapp-bot-scanner`
3. Click **"Add configuration and start analysis"**
4. The `.deepsource.toml` file in the repository root will be automatically detected
5. Analysis will start immediately

### 2. Configuration File

The `.deepsource.toml` file configures:

```toml
version = 1

[[analyzers]]
name = "docker"
enabled = true

[[analyzers]]
name = "javascript"
enabled = true
  [analyzers.meta]
  plugins = ["react"]
  environment = ["nodejs"]
  style_guide = "airbnb"
  dialect = "typescript"
```

**Excluded Patterns:**
- `**/node_modules/**` - Dependencies
- `**/dist/**` - Build output
- `**/coverage/**` - Test coverage reports
- `**/Research/**` - Research materials
- `**/whatsapp-web.js/**` - Third-party library

## Programmatic API Access

### Setup API Token

1. Go to [DeepSource Settings → Tokens](https://app.deepsource.com/settings/tokens)
2. Click **"Generate new token"**
3. Set a name (e.g., "CLI Access") and expiry date
4. Copy the token and add to your environment:

```bash
export DEEPSOURCE_API_TOKEN="your_token_here"
```

> **Security Note**: Never commit tokens to git. Add to `.env` or shell profile.

### Using the API Client

The `scripts/deepsource-api.js` script provides easy CLI access to DeepSource data:

#### View Repository Status

```bash
node scripts/deepsource-api.js status
```

**Output:**
```
📊 DeepSource Repository Status

Repository: whatsapp-bot-scanner
Activated: ✅
Default Branch: main

🔍 Analyzers:
  ✅ docker
  ✅ javascript

📈 Metrics:
  Total Issues: 42
  Anti-patterns: 8
  Bug Risks: 15
  Security: 3
  Performance: 5
  Style: 11
  Documentation: 0
```

#### List Current Issues

```bash
node scripts/deepsource-api.js issues
```

**Output:**
```
🐛 DeepSource Issues

Repository: whatsapp-bot-scanner
Total Issues: 20

1. 🔴 Avoid using 'any' type
   Category: ANTI_PATTERN
   Analyzer: javascript
   Occurrences: 12

2. 🟠 Unused variable 'result'
   Category: BUG_RISK
   Analyzer: javascript
   Occurrences: 3
```

#### Show Detailed Metrics

```bash
node scripts/deepsource-api.js metrics
```

#### View Current User

```bash
node scripts/deepsource-api.js viewer
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DEEPSOURCE_API_TOKEN` | ✅ Yes | - | Personal Access Token from DeepSource |
| `DEEPSOURCE_REPO_OWNER` | ❌ No | `ElliotBadinger` | Repository owner |
| `DEEPSOURCE_REPO_NAME` | ❌ No | `whatsapp-bot-scanner` | Repository name |

### Integration Examples

#### CI/CD Pipeline

```bash
# In GitHub Actions or similar
- name: Check DeepSource Status
  run: |
    export DEEPSOURCE_API_TOKEN=${{ secrets.DEEPSOURCE_TOKEN }}
    node scripts/deepsource-api.js status
    node scripts/deepsource-api.js metrics
```

#### Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

export DEEPSOURCE_API_TOKEN="your_token"
node scripts/deepsource-api.js status

# Fail if critical issues exist
CRITICAL_COUNT=$(node scripts/deepsource-api.js metrics | grep "Bug Risks" | awk '{print $3}')
if [ "$CRITICAL_COUNT" -gt 10 ]; then
  echo "❌ Too many critical issues. Fix before committing."
  exit 1
fi
```

#### Monitoring Script

```javascript
// scripts/monitor-code-quality.js
const { getRepositoryMetrics } = require('./deepsource-api');

async function checkQuality() {
  const data = await getRepositoryMetrics();
  const metrics = data.repository.metrics;
  
  if (metrics.securityCount > 0) {
    console.error(`⚠️  ${metrics.securityCount} security issues found!`);
    process.exit(1);
  }
  
  console.log('✅ Code quality checks passed');
}

checkQuality();
```

## API Reference

### GraphQL Endpoint

```
https://api.deepsource.io/graphql/
```

### Authentication

All requests require a Bearer token in the Authorization header:

```bash
curl 'https://api.deepsource.io/graphql/' \
  -X POST \
  -H 'Authorization: Bearer <TOKEN>' \
  -H 'Content-Type: application/json' \
  --data '{"query": "query { viewer { email } }"}'
```

### Rate Limits

- **5,000 requests per hour** per token
- Returns `429 Too Many Requests` when exceeded

## Troubleshooting

### "Repository not found"

- Ensure the repository is activated on DeepSource
- Check `DEEPSOURCE_REPO_OWNER` and `DEEPSOURCE_REPO_NAME` are correct

### "Authentication failed"

- Verify `DEEPSOURCE_API_TOKEN` is set correctly
- Check token hasn't expired in DeepSource settings
- Regenerate token if necessary

### "No issues found" but expecting issues

- Analysis may still be running (first run takes 5-10 minutes)
- Check DeepSource dashboard for analysis status
- Verify `.deepsource.toml` configuration is correct

## Next Steps

1. ✅ Activate repository on DeepSource
2. ✅ Generate Personal Access Token
3. ✅ Run `node scripts/deepsource-api.js status` to verify setup
4. 🔄 Review and fix reported issues
5. 🔄 Integrate into CI/CD pipeline
6. 🔄 Set up automated monitoring

## Resources

- [DeepSource Documentation](https://docs.deepsource.com)
- [GraphQL API Reference](https://docs.deepsource.com/docs/developers/api)
- [JavaScript Analyzer Docs](https://docs.deepsource.com/docs/analyzer/javascript)
- [Docker Analyzer Docs](https://docs.deepsource.com/docs/analyzer/docker)
