# WhatsApp Bot Scanner - Unified CLI Setup Examples

## 📖 Table of Contents

1. [Basic Setup Examples](#-basic-setup-examples)
2. [Advanced Configuration Examples](#-advanced-configuration-examples)
3. [CI/CD Integration Examples](#-cicd-integration-examples)
4. [Docker Configuration Examples](#-docker-configuration-examples)
5. [Troubleshooting Setup Examples](#-troubleshooting-setup-examples)
6. [Migration Setup Examples](#-migration-setup-examples)

## 🚀 Basic Setup Examples

### Example 1: Interactive Setup

```bash
# Clone the repository
git clone https://github.com/your-repo/whatsapp-bot-scanner.git
cd whatsapp-bot-scanner

# Install dependencies
npm install

# Run interactive setup wizard
npx whatsapp-bot-scanner setup

# Follow the prompts:
# 1. Enter VirusTotal API key when prompted
# 2. Optionally enter other API keys
# 3. Confirm configuration settings
# 4. Wait for Docker containers to build and start
# 5. Complete WhatsApp pairing if required
```

### Example 2: Hobby Mode Setup

```bash
# Clone and install
git clone https://github.com/your-repo/whatsapp-bot-scanner.git
cd whatsapp-bot-scanner
npm install

# Run hobby mode setup
npx whatsapp-bot-scanner setup --mvp-mode

# This will:
# - Use simplified configuration
# - Skip optional API keys
# - Configure for personal use
# - Use reduced resource requirements
```

### Example 3: Non-Interactive Setup

```bash
# Set environment variables
export VT_API_KEY="your_virustotal_api_key"
export GSB_API_KEY="your_google_safe_browsing_key"

# Run non-interactive setup
npx whatsapp-bot-scanner setup --noninteractive

# This is ideal for:
# - CI/CD pipelines
# - Automated deployments
# - Scripted installations
```

## ⚙️ Advanced Configuration Examples

### Example 1: Custom Configuration File

```bash
# Create custom configuration
cp .env.example custom-config.env
nano custom-config.env

# Edit custom-config.env with your settings:
# MODE=production
# VT_API_KEY=your_key
# WHATSAPP_AUTH=remote
# WHATSAPP_PHONE_NUMBER=+1234567890

# Run setup with custom config
npx whatsapp-bot-scanner setup --config custom-config.env
```

### Example 2: Production Environment Setup

```bash
# Production setup with all API keys
export VT_API_KEY="your_virustotal_key"
export GSB_API_KEY="your_google_key"
export URLSCAN_API_KEY="your_urlscan_key"
export WHOISXML_API_KEY="your_whoisxml_key"

# Run production setup
npx whatsapp-bot-scanner setup --noninteractive

# Verify production configuration
npx whatsapp-bot-scanner health --monitor
```

### Example 3: Multi-Service Configuration

```bash
# Configure for multiple WhatsApp clients
nano docker-compose.yml

# Add to docker-compose.yml:
# services:
#   wa-client-2:
#     <<: *wa-client
#     ports:
#       - "3003:3000"
#     environment:
#       - WHATSAPP_CLIENT_ID=client2

# Rebuild with new configuration
docker compose build --no-cache
docker compose up -d
```

## 🤖 CI/CD Integration Examples

### Example 1: GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy WhatsApp Bot Scanner

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Set up Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'

    - name: Install dependencies
      run: npm install

    - name: Run setup
      env:
        VT_API_KEY: ${{ secrets.VT_API_KEY }}
        GSB_API_KEY: ${{ secrets.GSB_API_KEY }}
      run: npx whatsapp-bot-scanner setup --noninteractive

    - name: Verify deployment
      run: npx whatsapp-bot-scanner health
```

### Example 2: GitLab CI Pipeline

```yaml
# .gitlab-ci.yml
stages:
  - deploy

deploy:
  stage: deploy
  image: node:20
  script:
    - npm install
    - npx whatsapp-bot-scanner setup --noninteractive
    - npx whatsapp-bot-scanner health
  only:
    - main
```

### Example 3: Jenkins Pipeline

```groovy
// Jenkinsfile
pipeline {
    agent any

    stages {
        stage('Deploy') {
            steps {
                sh 'git clone https://github.com/your-repo/whatsapp-bot-scanner.git'
                sh 'cd whatsapp-bot-scanner'
                sh 'npm install'
                withEnv(['VT_API_KEY=your_key', 'GSB_API_KEY=your_key']) {
                    sh 'npx whatsapp-bot-scanner setup --noninteractive'
                }
                sh 'npx whatsapp-bot-scanner health'
            }
        }
    }
}
```

## 🐳 Docker Configuration Examples

### Example 1: Custom Docker Configuration

```yaml
# docker-compose.override.yml
version: '3.8'

services:
  wa-client:
    deploy:
      resources:
        limits:
          cpus: '1.5'
          memory: 1G
    environment:
      - WHATSAPP_POLLING_INTERVAL=15000
      - WHATSAPP_MAX_RETRIES=5

  scan-orchestrator:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
    environment:
      - SCAN_CONCURRENCY=10
      - CACHE_TTL=3600
```

### Example 2: Production Docker Setup

```bash
# Build production-optimized images
docker compose -f docker-compose.yml -f docker-compose.prod.yml build

# Start with production configuration
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Verify production services
npx whatsapp-bot-scanner health --monitor --interval 5000
```

### Example 3: Resource Monitoring Setup

```bash
# Set up Docker resource monitoring
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"

# Create monitoring script
cat > monitor-services.sh << 'EOF'
#!/bin/bash
while true; do
  clear
  echo "WhatsApp Bot Scanner - Service Monitor"
  echo "========================================"
  docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
  npx whatsapp-bot-scanner health
  sleep 10
done
EOF

chmod +x monitor-services.sh
./monitor-services.sh
```

## 🔧 Troubleshooting Setup Examples

### Example 1: Dependency Issue Resolution

```bash
# Check Node.js version
node -v

# If Node.js is too old:
curl -fsSL https://fnm.vercel.app/install | bash -s -- --skip-shell
fnm install 20
fnm use 20

# Check Docker installation
docker --version
docker compose version

# If Docker is missing:
sudo apt-get update
sudo apt-get install docker.io docker-compose
sudo systemctl enable docker
sudo systemctl start docker
```

### Example 2: Configuration Validation

```bash
# Validate .env file syntax
npm run validate-env

# Check for missing variables
grep -v "^#" .env | grep -v "^$" | while read line; do
  if [[ ! $line =~ .*=.* ]]; then
    echo "Invalid line: $line"
  fi
done

# Test API key validation
npx whatsapp-bot-scanner setup --validate-api-key VT_API_KEY
```

### Example 3: Service Recovery

```bash
# Check service logs for errors
npx whatsapp-bot-scanner logs --tail 100 | grep -i error

# Restart problematic services
docker compose restart wa-client scan-orchestrator

# Rebuild if needed
docker compose build --no-cache wa-client
docker compose up -d wa-client

# Verify recovery
npx whatsapp-bot-scanner health
```

## 🔄 Migration Setup Examples

### Example 1: Legacy to Unified CLI Migration

```bash
# Backup existing configuration
cp .env .env.backup
cp docker-compose.yml docker-compose.yml.backup

# Install unified CLI
npm install -g whatsapp-bot-scanner

# Run migration wizard
npx whatsapp-bot-scanner setup

# Verify migration
npx whatsapp-bot-scanner health

# Compare configurations
diff .env.backup .env
```

### Example 2: Partial Migration with Fallback

```bash
# Test unified CLI alongside legacy scripts
npx whatsapp-bot-scanner health
./setup.sh --check-status

# Gradual migration approach
# 1. Start with status checking
npx whatsapp-bot-scanner health --monitor

# 2. Migrate logging
npx whatsapp-bot-scanner logs wa-client

# 3. Migrate pairing
npx whatsapp-bot-scanner pair

# 4. Full migration
npx whatsapp-bot-scanner setup
```

### Example 3: Rollback Procedure

```bash
# If migration fails, rollback to legacy

# Stop unified CLI services
docker compose down

# Restore backup configuration
cp .env.backup .env
cp docker-compose.yml.backup docker-compose.yml

# Restart legacy services
./setup.sh

# Verify rollback
./setup.sh --check-status
```

## 📚 Configuration Templates

### Basic Configuration Template

```ini
# .env - Basic Configuration
MODE=production

# Required API Key
VT_API_KEY=your_virustotal_api_key

# Optional API Keys
# GSB_API_KEY=your_google_safe_browsing_key
# URLSCAN_API_KEY=your_urlscan_api_key
# WHOISXML_API_KEY=your_whoisxml_api_key

# WhatsApp Configuration
WHATSAPP_AUTH=qr
WHATSAPP_AUTO_PAIRING=true

# Service Ports
WA_CLIENT_PORT=3000
SCAN_ORCHESTRATOR_PORT=3001
CONTROL_PLANE_PORT=3002

# Logging
LOG_LEVEL=info
LOG_MAX_SIZE=10m
```

### Production Configuration Template

```ini
# .env - Production Configuration
MODE=production

# All API Keys for production
VT_API_KEY=your_virustotal_api_key
GSB_API_KEY=your_google_safe_browsing_key
URLSCAN_API_KEY=your_urlscan_api_key
WHOISXML_API_KEY=your_whoisxml_api_key

# WhatsApp Configuration
WHATSAPP_AUTH=remote
WHATSAPP_PHONE_NUMBER=+1234567890
WHATSAPP_AUTO_PAIRING=true
WHATSAPP_POLLING_INTERVAL=30000

# Service Configuration
WA_CLIENT_REPLICAS=2
SCAN_ORCHESTRATOR_REPLICAS=2

# Performance
API_TIMEOUT=15000
SCAN_CONCURRENCY=5
CACHE_TTL=3600

# Logging
LOG_LEVEL=info
LOG_MAX_SIZE=50m
LOG_FILE=/var/log/whatsapp-bot-scanner.log

# Monitoring
MONITORING_INTERVAL=30000
HEALTH_CHECK_TIMEOUT=10000
```

### Development Configuration Template

```ini
# .env - Development Configuration
MODE=development

# Development API Keys
VT_API_KEY=your_dev_virustotal_key
# GSB_API_KEY=your_dev_google_key (optional for dev)

# WhatsApp Configuration
WHATSAPP_AUTH=qr
WHATSAPP_AUTO_PAIRING=false
WHATSAPP_POLLING_INTERVAL=60000

# Development Service Ports
WA_CLIENT_PORT=3000
SCAN_ORCHESTRATOR_PORT=3001
CONTROL_PLANE_PORT=3002
DEBUG_PORT=9229

# Development Logging
LOG_LEVEL=debug
LOG_MAX_SIZE=5m
LOG_CONSOLE=true

# Development Features
DEBUG_MODE=true
MOCK_API_RESPONSES=false
BYPASS_RATE_LIMITS=true
```

## 🎯 Best Practices

### Setup Best Practices

1. **Always backup** before making changes: `cp .env .env.backup`
2. **Use environment variables** for sensitive data: `export VT_API_KEY=...`
3. **Validate configuration** before deployment: `npx whatsapp-bot-scanner setup --noninteractive`
4. **Monitor during setup**: Use `--monitor` flag for real-time status
5. **Test in stages**: Verify each component before proceeding

### Configuration Best Practices

1. **Use different configs** for different environments (dev, staging, prod)
2. **Document your configuration** with comments in `.env` file
3. **Validate API keys** before deployment
4. **Set appropriate resource limits** based on your environment
5. **Use secrets management** for production deployments

### Troubleshooting Best Practices

1. **Check logs first**: `npx whatsapp-bot-scanner logs --tail 100`
2. **Isolate the problem**: Determine which component is failing
3. **Start with simple fixes**: Restart services before complex changes
4. **Document your steps**: Keep track of troubleshooting actions
5. **Seek help early**: Don't struggle alone with complex issues

## 📚 Additional Resources

- [User Guide](CLI_USER_GUIDE.md)
- [Technical Documentation](CLI_TECHNICAL_DOCUMENTATION.md)
- [Migration Guide](CLI_MIGRATION_GUIDE.md)
- [Troubleshooting Guide](CLI_TROUBLESHOOTING.md)
- [Visual Aids](CLI_VISUAL_AIDS.md)

## 🎉 Conclusion

These setup examples provide practical, real-world scenarios for deploying and configuring the WhatsApp Bot Scanner Unified CLI. Use them as starting points and adapt to your specific requirements.

**Remember**: Always test configurations in a development environment before deploying to production!