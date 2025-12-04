# WhatsApp Bot Scanner - Unified CLI User Guide

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

The WhatsApp Bot Scanner Unified CLI provides a comprehensive interface for setting up, managing, and monitoring your WhatsApp link scanning bot. This guide will help you get started with the new unified command-line interface.

### Prerequisites

Before using the unified CLI, ensure you have:

- Node.js 20.x or later
- Docker and Docker Compose v2
- Basic familiarity with command-line interfaces

### Quick Start

```bash
# Install the CLI
npm install -g whatsapp-bot-scanner

# Run the interactive setup wizard
npx whatsapp-bot-scanner setup

# Or use the unified command
./scripts/unified-cli.mjs
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
# Run complete setup wizard
npx whatsapp-bot-scanner setup

# Stream service logs
npx whatsapp-bot-scanner logs

# Manual WhatsApp pairing
npx whatsapp-bot-scanner pair

# Check service health
npx whatsapp-bot-scanner status
```

## 💬 Interactive Mode

Interactive mode provides a guided setup experience with prompts and visual feedback.

### Starting Interactive Setup

```bash
npx whatsapp-bot-scanner setup
```

### Interactive Setup Steps

1. **Prerequisites Check**: Automatically detects Docker, Node.js, and system capabilities
2. **API Key Collection**: Interactive prompts for required API keys
3. **Configuration Setup**: Environment configuration and validation
4. **Service Deployment**: Docker container build and startup
5. **WhatsApp Pairing**: QR code or phone number pairing process

### Interactive Features

- **Progress Indicators**: Visual spinners showing operation status
- **Validation Feedback**: Real-time input validation
- **Help System**: Context-sensitive help (press `?` for assistance)
- **Error Recovery**: Automatic error detection and recovery options

## ⚙️ Non-Interactive Mode

For automated deployments and CI/CD pipelines:

```bash
npx whatsapp-bot-scanner setup --noninteractive
```

### Non-Interactive Options

```bash
# Skip dependency checks (use with caution)
npx whatsapp-bot-scanner setup --noninteractive --skip-dependencies

# Hobby mode configuration
npx whatsapp-bot-scanner setup --noninteractive --hobby-mode
```

## 📚 Command Reference

### Main Commands

| Command         | Description               | Options                                                   |
| --------------- | ------------------------- | --------------------------------------------------------- |
| `setup`         | Run complete setup wizard | `--noninteractive`, `--hobby-mode`, `--skip-dependencies` |
| `logs`          | Stream service logs       | `--tail <lines>`, `--timestamps`, `--no-follow`           |
| `pair`          | Manual pairing request    | None                                                      |
| `status`        | Check service health      | `--monitor`, `--interval <ms>`                            |
| `compatibility` | Show migration info       | None                                                      |

### Setup Command Options

| Option                | Description                | Default |
| --------------------- | -------------------------- | ------- |
| `--noninteractive`    | Run without prompts        | false   |
| `--hobby-mode`        | Configure for personal use | false   |
| `--skip-dependencies` | Skip dependency checks     | false   |

### Logs Command Options

| Option           | Description             | Default |
| ---------------- | ----------------------- | ------- |
| `--tail <lines>` | Number of lines to show | 'all'   |
| `--timestamps`   | Show timestamps         | false   |
| `--no-follow`    | Don't follow logs       | false   |

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
# Check all service health
npx whatsapp-bot-scanner status

# Monitor service health continuously
npx whatsapp-bot-scanner status --monitor --interval 3000

# View specific service logs
npx whatsapp-bot-scanner logs scan-orchestrator
```

### Service Health Indicators

| Status       | Meaning                  | Action Required |
| ------------ | ------------------------ | --------------- |
| ✅ Healthy   | Service running normally | None            |
| ⚠️ Starting  | Service initializing     | Wait            |
| ❌ Unhealthy | Service failed           | Check logs      |
| ⏹️ Stopped   | Service not running      | Restart         |

## 🔧 Troubleshooting

### Common Issues and Solutions

| Issue                       | Solution                                                  |
| --------------------------- | --------------------------------------------------------- |
| Docker not detected         | Install Docker and Docker Compose v2                      |
| Node.js version too old     | Upgrade to Node.js 20.x or later                          |
| API key validation failed   | Check key format and permissions                          |
| Pairing code expired        | Request new code with `npx whatsapp-bot-scanner pair`     |
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
    npx whatsapp-bot-scanner setup --noninteractive --hobby-mode
```

## 🔄 Migration Guide

### From Legacy Scripts to Unified CLI

| Legacy Script            | Unified CLI Equivalent                        |
| ------------------------ | --------------------------------------------- |
| `setup.sh`               | `npx whatsapp-bot-scanner setup`              |
| `setup-hobby-express.sh` | `npx whatsapp-bot-scanner setup --hobby-mode` |
| `watch-pairing-code.js`  | `npx whatsapp-bot-scanner logs wa-client`     |
| `pair.sh`                | `npx whatsapp-bot-scanner pair`               |

### Migration Steps

1. **Backup existing configuration**: `cp .env .env.backup`
2. **Install unified CLI**: `npm install -g whatsapp-bot-scanner`
3. **Run migration**: `npx whatsapp-bot-scanner setup`
4. **Verify services**: `npx whatsapp-bot-scanner status`
5. **Clean up old scripts**: Remove deprecated scripts after successful migration

### Deprecation Timeline

- **Phase 1**: Parallel support (Current)
- **Phase 2**: Deprecation warnings (Next 3 months)
- **Phase 3**: Legacy script removal (After 6 months)

## 📚 Additional Resources

- [Technical Documentation](CLI_TECHNICAL_DOCUMENTATION.md)
- [API Reference](CLI_API_DOCUMENTATION.md)
- [Migration Checklist](CLI_MIGRATION_CHECKLIST.md)
- [Troubleshooting Guide](CLI_TROUBLESHOOTING.md)
