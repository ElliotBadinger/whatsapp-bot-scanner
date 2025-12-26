# WhatsApp Bot Scanner - Unified CLI (MVP-first)

## 📖 Table of Contents

1. [Getting Started](#-getting-started)
2. [Installation](#-installation)
3. [Basic Usage](#-basic-usage)
4. [Interactive Mode](#-interactive-mode)
5. [Non-Interactive Mode](#-non-interactive-mode)
6. [Command Reference](#-command-reference)
7. [Configuration Management](#-configuration-management)
8. [WhatsApp Pairing](#-whatsapp-pairing)
9. [Service Management](#-service-management)
10. [Troubleshooting](#-troubleshooting)
11. [Advanced Usage](#-advanced-usage)
12. [Migration Guide](#-migration-guide)

## 🚀 Getting Started

The CLI supports two paths:

- **MVP (single container)**: no Redis, no external enrichers by default.
- **Advanced (legacy)**: Redis/BullMQ + control-plane + monitoring.

### Prerequisites

- Node.js 20.x or later
- Docker and Docker Compose v2 (for Docker-based runs)

### Quick Start (MVP)

```bash
# Run the MVP setup wizard (single-container)
npx whatsapp-bot-scanner setup --mvp-mode

# Or run the CLI directly from the repo
./scripts/unified-cli.mjs setup --mvp-mode
```

## 📦 Installation

### Method 1: Global Installation

```bash
npm install -g whatsapp-bot-scanner
```

### Method 2: Local Project Setup

```bash
git clone https://github.com/your-repo/whatsapp-bot-scanner.git
cd whatsapp-bot-scanner
npm install
```

### Method 3: Direct Execution

```bash
./scripts/unified-cli.mjs
```

## 🎯 Basic Usage

The unified CLI provides several main commands:

```bash
# Run MVP setup wizard
npx whatsapp-bot-scanner setup --mvp-mode

# Stream service logs
npx whatsapp-bot-scanner logs

# Manual WhatsApp pairing
npx whatsapp-bot-scanner pair

# Check service health
npx whatsapp-bot-scanner health
```

## 💬 Interactive Mode

Interactive mode provides a guided setup experience with prompts and visual feedback.

### Starting Interactive Setup

```bash
npx whatsapp-bot-scanner setup
```

### Interactive Setup Steps

1. **Prerequisites Check**: Docker and Node.js checks
2. **Configuration Setup**: Writes `.env` from template
3. **API Keys (Advanced only)**: Skipped in MVP mode
4. **Service Deployment**: Starts containers
5. **WhatsApp Pairing**: QR code or phone number pairing

### Interactive Features

- Progress indicators
- Basic validation
- Error hints for common failures

## ⚙️ Non-Interactive Mode

For automated deployments and CI/CD pipelines:

```bash
npx whatsapp-bot-scanner setup --noninteractive --mvp-mode
```

### Non-Interactive Options

```bash
# Advanced (legacy) setup
npx whatsapp-bot-scanner setup --noninteractive --advanced
```

## 📚 Command Reference

### Main Commands

| Command | Description | Options |
|---------|-------------|---------|
| `setup` | Run setup wizard | `--noninteractive`, `--mvp-mode`, `--advanced`, `--skip-pairing` |
| `logs` | Stream service logs | `[service]` |
| `pair` | Manual pairing request | `--qr`, `--code` |
| `health` | Check service health | None |

### Setup Command Options

| Option | Description | Default |
|--------|-------------|---------|
| `--noninteractive` | Run without prompts | false |
| `--mvp-mode` | Single-container MVP setup | false |
| `--advanced` | Advanced (Redis/BullMQ) setup | false |
| `--skip-pairing` | Skip pairing step | false |

## ⚙️ Configuration Management

### Environment Configuration

The CLI manages your `.env` file with all required configuration:

```bash
# Create configuration from template
npx whatsapp-bot-scanner setup

# Edit configuration manually
nano .env
```

### API Key Management

The CLI supports these API keys:

- **VirusTotal API Key** (Required)
- **Google Safe Browsing API Key** (Optional)
- **URLScan API Key** (Optional)
- **WhoisXML API Key** (Optional)

### Configuration Validation

```bash
# Validate your configuration
npx whatsapp-bot-scanner setup --noninteractive
```

## 🔗 WhatsApp Pairing

### Pairing Process

1. **QR Code Pairing**: Scan QR code from WhatsApp mobile app
2. **Phone Number Pairing**: Enter pairing code manually

### Pairing Commands

```bash
# Start pairing process
npx whatsapp-bot-scanner pair

# Monitor pairing logs
npx whatsapp-bot-scanner logs wa-client
```

### Pairing Troubleshooting

- **Rate Limiting**: Wait for cooldown period before retrying
- **Code Expiration**: Request new code if expired (2 minutes)
- **Connection Issues**: Check Docker service health

## 🚀 Service Management

### Service Commands

```bash
# Check service health
npx whatsapp-bot-scanner health

# View specific service logs
npx whatsapp-bot-scanner logs wa-client
```

### Service Health Indicators

| Status | Meaning | Action Required |
|--------|---------|-----------------|
| ✅ Healthy | Service running normally | None |
| ⚠️ Starting | Service initializing | Wait |
| ❌ Unhealthy | Service failed | Check logs |
| ⏹️ Stopped | Service not running | Restart |

## 🔧 Troubleshooting

### Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| Docker not detected | Install Docker and Docker Compose v2 |
| Node.js version too old | Upgrade to Node.js 20.x or later |
| API key validation failed | Check key format and permissions |
| Pairing code expired | Request new code with `npx whatsapp-bot-scanner pair` |
| Service health check failed | Check logs with `npx whatsapp-bot-scanner logs <service>` |

### Error Recovery

```bash
# Restart failed services
docker compose restart

# Rebuild containers
docker compose build --no-cache

# Clean and restart
docker compose down && docker compose up -d
```

### Debugging Tips

- Use `--verbose` flag for detailed logging
- Check `docker logs` for container-specific issues
- Validate your `.env` file configuration

## 🎛️ Advanced Usage

### Custom Configuration

```bash
# Use custom configuration file
npx whatsapp-bot-scanner setup --config custom-config.env

# Override specific settings
export VT_API_KEY=your_key_here
npx whatsapp-bot-scanner setup
```

### Performance Tuning

```bash
# Adjust service resources
docker compose up -d --scale wa-client=2

# Monitor resource usage
docker stats
```

### Integration with CI/CD

```yaml
# Example GitHub Actions workflow
- name: Deploy WhatsApp Bot Scanner
  run: |
    npm install -g whatsapp-bot-scanner
    npx whatsapp-bot-scanner setup --noninteractive --mvp-mode
```

## 🔄 Migration Guide

### From Legacy Scripts to Unified CLI

| Legacy Script | Unified CLI Equivalent |
|---------------|-----------------------|
| `setup.sh` | `npx whatsapp-bot-scanner setup` |
| `setup-hobby-express.sh` | `npx whatsapp-bot-scanner setup --mvp-mode` |
| `watch-pairing-code.js` | `npx whatsapp-bot-scanner logs wa-client` |
| `pair.sh` | `npx whatsapp-bot-scanner pair` |

### Migration Steps

1. **Backup existing configuration**: `cp .env .env.backup`
2. **Install unified CLI**: `npm install -g whatsapp-bot-scanner`
3. **Run migration**: `npx whatsapp-bot-scanner setup`
4. **Verify services**: `npx whatsapp-bot-scanner health`
5. **Clean up old scripts**: Remove deprecated scripts after successful migration

### Deprecation Timeline

- **Phase 1**: Parallel support (Current)
- **Phase 2**: Deprecation warnings (Next 3 months)
- **Phase 3**: Legacy script removal (After 6 months)

## 📚 Additional Resources

- [Technical Documentation](CLI_TECHNICAL_DOCUMENTATION.md)
- [Troubleshooting Guide](CLI_TROUBLESHOOTING.md)
