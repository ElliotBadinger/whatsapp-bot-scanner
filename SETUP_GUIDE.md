# WhatsApp Bot Scanner - Complete Setup Guide

This guide ensures setup works in **any environment** with **zero prerequisites**.

## Quick Start (One-Liner)

For completely fresh systems (no Node.js, Docker, or Git):

```bash
curl -fsSL https://raw.githubusercontent.com/ElliotBadinger/whatsapp-bot-scanner/main/scripts/remote-bootstrap.sh | bash
```

## Standard Setup (If You Have Git)

```bash
git clone https://github.com/ElliotBadinger/whatsapp-bot-scanner.git
cd whatsapp-bot-scanner
./bootstrap.sh
```

## What Gets Installed Automatically

The bootstrap script will automatically install:

1. **System Packages**: curl, git, make, build-essential
2. **Node.js 20+**: Via fnm (Fast Node Manager) or system package manager
3. **Docker**: Via official Docker installation script
4. **npm Dependencies**: All project dependencies

## Environment-Specific Instructions

### GitHub Codespaces

Docker is pre-installed. Just run:

```bash
./bootstrap.sh
```

### VS Code Dev Containers

If Docker socket is not mounted, the script will:

1. Detect the issue
2. Auto-configure `devcontainer.json`
3. Prompt you to rebuild the container

### WSL2 (Windows)

```bash
# Install WSL2 first (from PowerShell as Admin):
wsl --install -d Ubuntu

# Then inside WSL2:
./bootstrap.sh
```

### macOS

```bash
# Homebrew will be used for package management
./bootstrap.sh
```

### Linux (Ubuntu/Debian)

```bash
./bootstrap.sh
```

### Linux (Fedora/RHEL/CentOS)

```bash
./bootstrap.sh
```

### Linux (Arch)

```bash
./bootstrap.sh
```

### Alpine Linux (Containers)

```bash
./bootstrap.sh
```

## Troubleshooting

### Network Issues During Build

The Docker build includes automatic retry logic for network failures:

- **npm registry timeouts**: Automatically retries up to 5 times
- **DNS resolution failures**: Waits and retries
- **Slow connections**: Extended timeouts (up to 2 minutes)

If build still fails due to network:

```bash
# Clear Docker cache and retry
docker system prune -f
make build
```

### Docker Daemon Not Running

```bash
# Linux (systemd)
sudo systemctl start docker

# Linux (service)
sudo service docker start

# macOS/Windows
# Start Docker Desktop application
```

### Permission Denied (Docker Socket)

```bash
# Add your user to docker group
sudo usermod -aG docker $USER

# Log out and log back in, or run:
newgrp docker
```

### Node.js Version Too Old

```bash
# The bootstrap script will handle this automatically
./bootstrap.sh
```

### Build Fails with "Cannot find module 'confusable'"

This has been fixed in the latest version. Update and rebuild:

```bash
git pull
make build
```

### Out of Disk Space

```bash
# Clean up Docker resources
docker system prune -a -f --volumes

# Check available space
df -h
```

### Out of Memory

Minimum requirements:

- **RAM**: 4GB (8GB recommended)
- **Disk**: 10GB free space

For low-memory systems:

```bash
# Build without parallel processing
docker compose build
```

## Validation

Before building, validate your environment:

```bash
./scripts/validate-environment.sh
```

This checks:

- ✓ Node.js 20+
- ✓ Docker installed and running
- ✓ Docker Compose available
- ✓ Network connectivity
- ✓ Sufficient disk space
- ✓ Sufficient memory

## Build Process

### Standard Build

```bash
make build
```

### Build with Retry (Network Issues)

The Makefile automatically retries failed builds:

```bash
make build
# If parallel build fails, automatically retries without parallel
# If that fails, shows helpful error message
```

### Manual Build (No Make)

```bash
docker compose build
```

## Starting Services

### Minimal Setup (Core Services Only)

```bash
make up-minimal
```

### Full Setup (With Monitoring)

```bash
make up-full
```

### Check Service Status

```bash
docker compose ps
```

### View Logs

```bash
make logs
```

## Common Failure Scenarios & Solutions

| Scenario                     | Solution                                     |
| ---------------------------- | -------------------------------------------- |
| No prerequisites installed   | Run `./bootstrap.sh`                         |
| Docker not running           | `sudo systemctl start docker`                |
| Network timeout during build | Automatic retry (built-in)                   |
| Permission denied            | `sudo usermod -aG docker $USER`              |
| Out of disk space            | `docker system prune -a -f`                  |
| Module not found error       | Fixed in latest version                      |
| Can't reach npm registry     | Check internet connection, retries automatic |
| Build fails in Codespaces    | Network issue, wait and retry                |

## Zero-Downtime Updates

```bash
# Pull latest changes
git pull

# Rebuild (old containers keep running)
make build

# Rolling update
docker compose up -d
```

## Complete Teardown

```bash
# Stop and remove everything
make down

# Also remove images
docker compose down --rmi all

# Nuclear option (removes all Docker data)
docker system prune -a -f --volumes
```

## Getting Help

1. **Validate environment**: `./scripts/validate-environment.sh`
2. **Check logs**: `make logs`
3. **View service status**: `docker compose ps`
4. **Report issues**: Include output from validation script

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Setup Flow                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. bootstrap.sh                                            │
│     ├─ Install system packages (curl, git, make)           │
│     ├─ Install Node.js 20+ (via fnm)                       │
│     ├─ Install Docker (via get.docker.com)                 │
│     └─ Run npm install                                      │
│                                                             │
│  2. make build                                              │
│     ├─ Check Docker availability                           │
│     ├─ Build images with retry logic                       │
│     └─ Handle network failures gracefully                  │
│                                                             │
│  3. make up                                                 │
│     ├─ Start services                                       │
│     ├─ Wait for health checks                              │
│     └─ Display service URLs                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Success Criteria

After successful setup, you should see:

```bash
$ docker compose ps
NAME                STATUS              PORTS
control-plane       running (healthy)   0.0.0.0:8080->8080/tcp
scan-orchestrator   running (healthy)   0.0.0.0:3001->3001/tcp
wa-client           running (healthy)   0.0.0.0:3000->3000/tcp
postgres            running (healthy)   5432/tcp
redis               running (healthy)   6379/tcp
```

## Next Steps

1. Access the control plane: `http://localhost:8080`
2. View monitoring: `http://localhost:3000` (if using up-full)
3. Check WhatsApp connection: `docker compose logs wa-client`

## Support

- **Documentation**: See `docs/` directory
- **Issues**: GitHub Issues
- **Validation**: `./scripts/validate-environment.sh`
