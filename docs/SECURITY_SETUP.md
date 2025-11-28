# Security Setup Guide

This document provides instructions for securely configuring the WhatsApp Bot Scanner with required API keys, secrets, and credentials.

> [!CAUTION]
> **Never commit secrets to version control**. All sensitive credentials should be stored in the `.env` file, which is gitignored.

## Required Secrets

### Database Credentials

**POSTGRES_PASSWORD**
- Generate a strong password for the PostgreSQL database
- **Generation command**: `openssl rand -hex 32`
- Set in `.env`: `POSTGRES_PASSWORD=your_generated_password`

### API Keys

#### VirusTotal (VT_API_KEY)
- **Purpose**: URL reputation checking and malware scanning
- **Get your key**: https://www.virustotal.com/gui/my-apikey
- **Free tier**: 4 requests/minute
- Set in `.env`: `VT_API_KEY=your_virustotal_api_key`

#### Google Safe Browsing (GSB_API_KEY)
- **Purpose**: Check URLs against Google's safe browsing database
- **Get your key**: https://console.cloud.google.com/apis/credentials
  1. Create a new project or select existing
  2. Enable "Safe Browsing API"
  3. Create credentials → API key
- Set in `.env`: `GSB_API_KEY=your_google_safe_browsing_key`

#### WhoisXML API (WHOISXML_API_KEY)
- **Purpose**: Domain WHOIS lookups for reputation analysis
- **Get your key**: https://whoisxmlapi.com/
- **Free tier**: 500 queries/month
- Set in `.env`: `WHOISXML_API_KEY=your_whoisxml_api_key`

#### urlscan.io (URLSCAN_API_KEY)
- **Purpose**: Deep URL scanning and screenshot analysis
- **Get your key**: https://urlscan.io/user/profile/
- **Free tier**: Limited scans per day
- Set in `.env`: `URLSCAN_API_KEY=your_urlscan_api_key`

### Application Secrets

All application secrets should be generated using cryptographically secure random generators.

#### Control  Plane API Token (CONTROL_PLANE_API_TOKEN)
- **Purpose**: Authentication for the control plane API
- **Generation command**: `openssl rand -hex 32`
- Set in `.env`: `CONTROL_PLANE_API_TOKEN=your_generated_token`

#### JWT Secret (JWT_SECRET)
- **Purpose**: Signing JSON Web Tokens for authentication
- **Generation command**: `openssl rand -hex 32`
- Set in `.env`: `JWT_SECRET=your_generated_secret`

#### Session Secret (SESSION_SECRET)
- **Purpose**: Encrypting session data
- **Generation command**: `openssl rand -base64 48`
- Set in `.env`: `SESSION_SECRET=your_generated_secret`

#### WhatsApp Remote Auth Data Key (WA_REMOTE_AUTH_DATA_KEY)
- **Purpose**: Encrypting WhatsApp authentication data
- **Generation command**: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
- Set in `.env`: `WA_REMOTE_AUTH_DATA_KEY=your_generated_key`

#### WhatsApp Remote Auth Shared Secret (WA_REMOTE_AUTH_SHARED_SECRET)
- **Purpose**: Shared secret for WhatsApp authentication
- **Generation command**: `openssl rand -hex 32`
- Set in `.env`: `WA_REMOTE_AUTH_SHARED_SECRET=your_generated_secret`

#### URLScan Callback Secret (URLSCAN_CALLBACK_SECRET)
- **Purpose**: Validating URLScan.io webhook callbacks
- **Generation command**: `openssl rand -hex 32`
- Set in `.env`: `URLSCAN_CALLBACK_SECRET=your_generated_secret`

## Optional: DeepSource API Token

If you want to use the DeepSource integration scripts for code analysis:

**DEEPSOURCE_API_TOKEN**
- **Purpose**: Programmatic access to DeepSource security reports
- **Get your token**: https://app.deepsource.com/settings/tokens
- Set in `.env`: `DEEPSOURCE_API_TOKEN=your_deepsource_token`
- **Scripts that use this**:
  - `scripts/probe-deepsource.js`
  - `scripts/explore-deepsource-schema.js`
  - `scripts/fetch-security-reports.js`

## Quick Setup Script

Run this script to generate all required secrets at once:

```bash
#!/bin/bash
# generate-secrets.sh

echo "Generating secure secrets..."
echo ""

echo "# Database"
echo "POSTGRES_PASSWORD=$(openssl rand -hex 32)"
echo ""

echo "# Application Secrets"
echo "CONTROL_PLANE_API_TOKEN=$(openssl rand -hex 32)"
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "SESSION_SECRET=$(openssl rand -base64 48)"
echo "WA_REMOTE_AUTH_DATA_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"
echo "WA_REMOTE_AUTH_SHARED_SECRET=$(openssl rand -hex 32)"
echo "URLSCAN_CALLBACK_SECRET=$(openssl rand -hex 32)"
echo ""

echo "# Copy these values to your .env file"
echo "# Then add your API keys from the services listed in docs/SECURITY_SETUP.md"
```

Save as `scripts/generate-secrets.sh`, make executable with `chmod +x scripts/generate-secrets.sh`, and run with `./scripts/generate-secrets.sh`.

## Security Best Practices

1. **Never commit `.env` to git** - It's already in `.gitignore`, but verify with `git check-ignore .env`
2. **Use different secrets for production and development** - Never reuse secrets across environments
3. **Rotate secrets regularly** - Update secrets periodically, especially after team member changes
4. **Store production secrets securely** - Use secret management tools like:
   - AWS Secrets Manager
   - HashiCorp Vault
   - Google Secret Manager
   - Azure Key Vault
5. **limit API key permissions** - Use the minimum required permissions for each service
6. **Monitor API usage** - Watch for unexpected spikes that could indicate key compromise

## Troubleshooting

### Application won't start

**Error**: `POSTGRES_PASSWORD is required` or similar
- **Solution**: Ensure all required secrets are set in `.env`

### API rate limiting

**Error**: `Rate limit exceeded` from VirusTotal or other services  
- **Solution**: Check your API tier limits and consider upgrading or reducing request frequency

### Invalid API key

**Error**: `401 Unauthorized` or `Invalid API key`
- **Solution**: Verify the API key is correct and hasn't been revoked. Regenerate if necessary.

## Environment Variable Priority

The application loads environment variables in this order (later sources override earlier):
1. System environment variables
2. `.env` file in project root
3. Docker Compose environment variables (when running in containers)

For production deployments, use system environment variables or container secrets instead of `.env` files.
