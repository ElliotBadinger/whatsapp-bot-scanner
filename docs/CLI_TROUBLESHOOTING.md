# WhatsApp Bot Scanner - Unified CLI Troubleshooting Guide

## 📖 Table of Contents

1. [Common Issues](#-common-issues)
2. [Error Messages](#-error-messages)
3. [Service Problems](#-service-problems)
4. [Pairing Issues](#-pairing-issues)
5. [Configuration Problems](#-configuration-problems)
6. [Performance Issues](#-performance-issues)
7. [Debugging Techniques](#-debugging-techniques)
8. [Log Analysis](#-log-analysis)
9. [Recovery Procedures](#-recovery-procedures)

## ❌ Common Issues

### Installation Problems

| Issue | Solution |
|-------|----------|
| `command not found: npx` | Install Node.js 20.x or later |
| `Permission denied` | Use `sudo` or fix file permissions |
| `npm install fails` | Check network connection and npm registry |
| `Docker not found` | Install Docker and Docker Compose v2 |

### Dependency Issues

| Issue | Solution |
|-------|----------|
| `Node.js version too old` | Upgrade to Node.js 20.x: `nvm install 20` |
| `Docker daemon not running` | Start Docker: `sudo systemctl start docker` |
| `Missing system packages` | Install required packages for your OS |
| `Dependency verification failed` | Run with `--skip-dependencies` and install manually |

## ❗ Error Messages

### CLI Error Messages

| Error Message | Cause | Solution |
|---------------|-------|----------|
| `Unified CLI failed: Environment detection failed` | System detection issue | Check system capabilities and permissions |
| `Dependency error: Node.js not found` | Node.js not installed | Install Node.js 20.x or later |
| `Dependency error: Docker not found` | Docker not installed | Install Docker and Docker Compose |
| `Configuration error: Invalid API key` | Malformed API key | Check key format and try again |
| `Docker error: Container failed to start` | Container configuration issue | Check Docker logs and configuration |

### Service Error Messages

| Error Message | Service | Solution |
|---------------|---------|----------|
| `Service unhealthy: wa-client` | wa-client | Check WhatsApp connection and pairing |
| `Service unhealthy: scan-orchestrator` | scan-orchestrator | Check API keys and network connectivity |
| `Service unhealthy: control-plane` | control-plane | Check configuration and ports |
| `Service unhealthy: redis` | redis | Check Docker resource allocation |
| `Service unhealthy: postgres` | postgres | Check database initialization |

## 🚨 Service Problems

### Service Health Issues

```bash
# Check service health
npx whatsapp-bot-scanner status

# Check specific service
npx whatsapp-bot-scanner status --monitor --interval 2000
```

### Service Recovery

```bash
# Restart specific service
docker compose restart wa-client

# Restart all services
docker compose restart

# Rebuild and restart
docker compose down && docker compose up -d
```

### Service Logs

```bash
# View service logs
npx whatsapp-bot-scanner logs wa-client

# View with timestamps
npx whatsapp-bot-scanner logs wa-client --timestamps

# View last 100 lines
npx whatsapp-bot-scanner logs wa-client --tail 100
```

## 🔗 Pairing Issues

### Pairing Error Messages

| Error Message | Cause | Solution |
|---------------|-------|----------|
| `Pairing code expired` | Code not used in time | Request new code |
| `Rate limited: Too many attempts` | Too many pairing attempts | Wait for cooldown period |
| `Invalid pairing code` | Incorrect code entered | Request new code and try again |
| `QR code not scanned` | QR code timeout | Generate new QR code |

### Pairing Recovery

```bash
# Request new pairing code
npx whatsapp-bot-scanner pair

# Monitor pairing process
npx whatsapp-bot-scanner logs wa-client

# Reset pairing session
docker compose restart wa-client
```

### Pairing Troubleshooting Steps

1. **Check WhatsApp app**: Ensure you're using the latest version
2. **Verify phone number**: Use correct international format
3. **Check network**: Ensure stable internet connection
4. **Restart services**: `docker compose restart wa-client`
5. **Clear session**: Remove `whatsapp-session` volume and restart

## ⚙️ Configuration Problems

### Configuration Error Messages

| Error Message | Cause | Solution |
|---------------|-------|----------|
| `Invalid API key format` | Malformed API key | Check key format (32+ alphanumeric) |
| `API key validation failed` | Invalid or expired key | Verify key with service provider |
| `Configuration file not found` | Missing .env file | Create from template: `cp .env.example .env` |
| `Port conflict detected` | Port already in use | Change port or stop conflicting service |

### Configuration Validation

```bash
# Validate configuration
npx whatsapp-bot-scanner setup --noninteractive

# Check specific API key
npx whatsapp-bot-scanner setup --validate-api-key VT_API_KEY
```

### Configuration Recovery

```bash
# Restore from backup
cp .env.backup .env

# Reset to default
cp .env.example .env

# Edit configuration
nano .env
```

## 🚀 Performance Issues

### Performance Problems

| Issue | Solution |
|-------|----------|
| Slow setup process | Check Docker cache and network speed |
| High memory usage | Increase Docker resource limits |
| Slow API responses | Check API key rate limits and quotas |
| Container startup delays | Check system resource availability |

### Performance Optimization

```bash
# Check system resources
docker stats

# Clean Docker system
docker system prune -a

# Increase Docker resources
# Edit Docker Desktop settings or /etc/docker/daemon.json
```

### Performance Monitoring

```bash
# Monitor service performance
npx whatsapp-bot-scanner status --monitor

# Check resource usage
top
htop

# Monitor Docker events
docker events
```

## 🔍 Debugging Techniques

### Debugging Commands

```bash
# Enable verbose logging
DEBUG=* npx whatsapp-bot-scanner setup

# Check environment variables
printenv | grep WHATSAPP

# Test API connectivity
curl -v https://www.virustotal.com/api/v3/ip_addresses/8.8.8.8

# Check Docker network
docker network inspect whatsapp-bot-scanner_default
```

### Debugging Tools

| Tool | Purpose | Command |
|------|---------|---------|
| `docker logs` | View container logs | `docker logs wa-client` |
| `docker inspect` | Inspect container details | `docker inspect wa-client` |
| `docker stats` | Monitor resource usage | `docker stats` |
| `docker events` | Monitor Docker events | `docker events` |
| `journalctl` | View system logs | `journalctl -u docker` |

## 📜 Log Analysis

### Log File Locations

| Service | Log Location | View Command |
|---------|--------------|--------------|
| wa-client | Docker container | `npx whatsapp-bot-scanner logs wa-client` |
| scan-orchestrator | Docker container | `npx whatsapp-bot-scanner logs scan-orchestrator` |
| control-plane | Docker container | `npx whatsapp-bot-scanner logs control-plane` |
| redis | Docker container | `docker logs redis` |
| postgres | Docker container | `docker logs postgres` |

### Log Analysis Techniques

```bash
# Search for errors
npx whatsapp-bot-scanner logs wa-client | grep -i error

# Search for warnings
npx whatsapp-bot-scanner logs scan-orchestrator | grep -i warn

# Follow logs in real-time
npx whatsapp-bot-scanner logs --follow

# Save logs to file
npx whatsapp-bot-scanner logs wa-client > wa-client.log
```

### Common Log Patterns

| Pattern | Meaning | Action |
|---------|---------|--------|
| `Error: Connection refused` | Network connectivity issue | Check network and firewall |
| `Error: Invalid API key` | API key problem | Validate API keys |
| `Error: Rate limited` | API rate limit reached | Wait or upgrade plan |
| `Error: Database connection` | Database issue | Check PostgreSQL service |
| `Error: WhatsApp session` | Session problem | Restart wa-client |

## 🔄 Recovery Procedures

### Standard Recovery Procedures

```bash
# Soft recovery (restart services)
docker compose restart

# Medium recovery (rebuild containers)
docker compose build --no-cache
docker compose up -d

# Hard recovery (clean restart)
docker compose down -v
rm -rf .env node_modules package-lock.json
git checkout .
npm install
npx whatsapp-bot-scanner setup
```

### Data Recovery

```bash
# Backup database
docker exec postgres pg_dump -U postgres -d whatsapp_bot > backup.sql

# Restore database
cat backup.sql | docker exec -i postgres psql -U postgres -d whatsapp_bot

# Export configuration
cp .env config-backup.env

# Import configuration
cp config-backup.env .env
```

### Emergency Recovery

```bash
# Complete system reset
docker system prune -a --volumes
rm -rf whatsapp-bot-scanner
git clone https://github.com/your-repo/whatsapp-bot-scanner.git
cd whatsapp-bot-scanner
npx whatsapp-bot-scanner setup
```

## 📚 Advanced Troubleshooting

### Network Troubleshooting

```bash
# Check network connectivity
ping 8.8.8.8
curl -v https://www.google.com

# Check Docker network
docker network ls
docker network inspect whatsapp-bot-scanner_default

# Test service connectivity
curl -v http://localhost:3000/healthz
```

# CLI Troubleshooting

## Fedora + Docker: containers can’t reach external network (bridge mode) and services log `ConnectionRefused`

### Symptoms
- `scan-orchestrator` logs `ConnectionRefused` / timeouts for:
  - `https://openphish.com/feed.txt`
  - `https://safebrowsing.googleapis.com/...`
- In-container requests fail (DNS and/or TCP egress), but the **host** can reach the same URLs.
- A host-networked dev service works (e.g. `scan-orchestrator-host`), confirming app logic is fine.

### Root cause (Fedora)
On Fedora with `firewalld` + nftables + Docker bridge networking, **bridge netfilter can interfere with container-to-container traffic and/or egress** depending on ruleset/driver behavior. A practical mitigation that restores container networking on affected systems is disabling bridge netfilter processing.

### Fix (production-safe; does NOT require host networking)
Apply these sysctls on the host:

```sh
sudo sysctl -w net.bridge.bridge-nf-call-iptables=0
sudo sysctl -w net.bridge.bridge-nf-call-ip6tables=0
```

Persist across reboots:

```sh
sudo tee /etc/sysctl.d/99-docker-bridge-nf.conf >/dev/null <<'EOF'
net.bridge.bridge-nf-call-iptables=0
net.bridge.bridge-nf-call-ip6tables=0
EOF

sudo sysctl --system
```

> Note: Disabling bridge netfilter changes how packets traversing Linux bridges are inspected by iptables/nftables. This is a common workaround when Docker bridge networking is broken by bridge netfilter interaction.

### Verification (quick + production-safe)
1) Confirm the host can reach external URLs:
```sh
curl -I https://openphish.com/feed.txt
```

2) Confirm container egress works (DNS + HTTPS):
```sh
docker compose exec -T scan-orchestrator sh -lc "timeout 8s bun -e \"fetch('https://www.google.com').then(r=>console.log('google',r.status)).catch(e=>console.error('google_err',e.code||e.name,e.message))\" || true"
docker compose exec -T scan-orchestrator sh -lc "timeout 8s bun -e \"fetch('https://openphish.com/feed.txt',{redirect:'follow'}).then(r=>console.log('openphish',r.status,r.url)).catch(e=>console.error('openphish_err',e.code||e.name,e.message))\" || true"
```

3) Confirm service logs no longer show `ConnectionRefused` for OpenPhish/GSB:
```sh
docker compose logs --tail 200 scan-orchestrator
```

### Dev-only quick test (optional)
If you need a fast A/B test to separate “Docker bridge egress” from “app logic”, run the host-networked dev service:

```sh
docker compose -f docker-compose.dev.yml up -d --build scan-orchestrator-host
docker compose -f docker-compose.dev.yml logs --tail 200 scan-orchestrator-host
docker compose -f docker-compose.dev.yml down
```

```bash
# Test VirusTotal API
curl -v -H "x-apikey: YOUR_VT_API_KEY" https://www.virustotal.com/api/v3/ip_addresses/8.8.8.8

# Test Google Safe Browsing
curl -v -H "Content-Type: application/json" \
  -d '{"client": {"clientId": "your-client", "clientVersion": "1.0"}, "threatInfo": {"threatTypes": ["MALWARE"], "platformTypes": ["ANY_PLATFORM"], "threatEntryTypes": ["URL"], "threatEntries": [{"url": "http://example.com"}]}}' \
  "https://safebrowsing.googleapis.com/v4/threatMatches:find?key=YOUR_GSB_API_KEY"
```

### Configuration Troubleshooting

```bash
# Validate .env file syntax
npm run validate-env

# Check for missing variables
grep -v "^#" .env | grep -v "^$"

# Test configuration loading
node -e "require('dotenv').config(); console.log(process.env.VT_API_KEY ? 'OK' : 'MISSING')"
```

## 🎯 Troubleshooting Checklist

### Basic Troubleshooting Checklist

- [ ] Check Docker is running: `docker info`
- [ ] Verify Node.js version: `node -v`
- [ ] Validate API keys in `.env` file
- [ ] Check service health: `npx whatsapp-bot-scanner status`
- [ ] Review logs for errors: `npx whatsapp-bot-scanner logs`
- [ ] Test network connectivity: `ping 8.8.8.8`
- [ ] Verify system resources: `free -m`, `df -h`

### Advanced Troubleshooting Checklist

- [ ] Check Docker resource limits: `docker info | grep "CPUs\|Memory"`
- [ ] Test API endpoints manually: `curl` commands
- [ ] Inspect Docker network: `docker network inspect`
- [ ] Check container resource usage: `docker stats`
- [ ] Validate configuration syntax: `npm run validate-env`
- [ ] Test database connectivity: `docker exec postgres psql -U postgres`
- [ ] Review system logs: `journalctl -u docker`

## 📅 When to Seek Help

### Self-Help Resources

1. **Documentation**: Review this troubleshooting guide
2. **Logs**: Analyze service logs thoroughly
3. **Configuration**: Double-check your `.env` file
4. **Dependencies**: Verify all prerequisites are installed

### Community Support

1. **GitHub Issues**: Open an issue with detailed error information
2. **Discussions**: Check GitHub Discussions for similar problems
3. **Stack Overflow**: Search for related questions and solutions

### Professional Support

1. **Enterprise Support**: Contact support@whatsapp-bot-scanner.com
2. **Consulting**: Request professional setup assistance
3. **Training**: Attend troubleshooting workshops

## 📚 Additional Resources

- [User Guide](CLI_USER_GUIDE.md)
- [Technical Documentation](CLI_TECHNICAL_DOCUMENTATION.md)
- [Migration Guide](CLI_MIGRATION_GUIDE.md)
- [Architecture Specification](UNIFIED_CLI_TECHNICAL_SPECIFICATION.md)

## 🎯 Troubleshooting Best Practices

1. **Isolate the Problem**: Determine which component is failing
2. **Check Logs First**: Always review logs before taking action
3. **Start Simple**: Try basic recovery before complex solutions
4. **Document Changes**: Keep track of what you modify
5. **Test Incrementally**: Verify each step before proceeding
6. **Backup First**: Always backup before making changes
7. **Seek Help Early**: Don't struggle alone with complex issues

## 🔧 Pro Tips

- Use `tmux` or `screen` for long-running operations
- Set up log rotation for long-term deployments
- Monitor resource usage regularly
- Keep backups of working configurations
- Test changes in a staging environment first
- Document your troubleshooting steps for future reference