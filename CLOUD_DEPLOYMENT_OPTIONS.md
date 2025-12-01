# Cloud Deployment Options for WhatsApp Bot Scanner

**Date:** 2025-11-30  
**Focus:** Free Tier Cloud Services with High Throughput, Low Latency & Custom Domains

---

## Executive Summary

Your WhatsApp bot scanner requires:

- **5 services**: wa-client (1GB RAM), scan-orchestrator (1GB RAM), control-plane (512MB RAM), reverse-proxy (256MB RAM), uptime-kuma (256MB RAM)
- **Infrastructure**: PostgreSQL (512MB RAM), Redis (512MB RAM)
- **Total Resources**: ~3.5GB RAM, multiple vCPUs, persistent storage
- **Custom domains** for control plane services (Grafana, Uptime Kuma, Prometheus)
- **High throughput** for fast link scanning and verdict delivery

**Challenge:** Most free tiers are designed for small apps (~512MB RAM), not production microservices stacks.

---

## 🏆 Top Recommendations (Ranked)

### 1. **Koyeb** ⭐ Best Free Tier for Your Use Case

**Free Tier Specs:**

- **1 web service**: 512MB RAM, 0.1 vCPU, 2GB SSD
- **1 PostgreSQL database**: 5 hours active time, 1GB storage
- **5 custom domains** included on Starter plan ($0/month + compute)
- **Built-in Redis via Upstash Marketplace** (separate free tier)
- Automatic TLS/SSL for custom domains
- Frankfurt or Washington, D.C. regions

**Why Koyeb:**
✅ **Best custom domain support** (5 domains free)  
✅ Docker deployment from registry or Dockerfile  
✅ Includes free PostgreSQL  
✅ Auto-scales (but scales to zero after 1 hour inactivity)  
✅ Git-driven deployment with automatic builds

**Limitations:**
⚠️ **Only 1 web service** on free tier (you need 5)  
⚠️ **5 hours compute for PostgreSQL** (not suitable for always-on)  
⚠️ Scales to zero after 1 hour idle → **NOT suitable for real-time WhatsApp bot**

**Verdict:** ❌ Not viable for your full stack on free tier alone

---

### 2. **Northflank Sandbox** ⭐⭐ Best for Development/Testing

**Free Tier Specs:**

- **2 free services** (Docker containers)
- **2 free databases** (PostgreSQL + Redis included)
- Custom Dockerfiles and buildpacks
- Automated database management (logs, metrics, backups)
- Container-based MySQL, PostgreSQL, MongoDB, Redis support

**Why Northflank:**
✅ **2 databases free** (PostgreSQL + Redis covered)  
✅ Docker container deployment  
✅ Automated monitoring and backups  
✅ Good for testing your full stack

**Limitations:**
⚠️ **Only 2 free services** (you need 5)  
⚠️ Sandbox is for "testing and building" (not production-ready)  
⚠️ Custom domain support unclear on free tier

**Verdict:** ⚠️ Good for **development/staging**, not full production

---

### 3. **Render** ⭐⭐⭐ Best Overall for Free Production

**Free Tier Specs:**

- **750 hours of total execution per month** (across all free services)
- **0.1 vCPU, 512MB RAM** per free web service
- **100GB bandwidth/month**
- **Free PostgreSQL** (expires after 90 days ❗)
- **Free Redis** (can restart anytime ❗)
- **Up to 2 custom domains** on hobby workspaces

**Why Render:**
✅ Multiple free services (can deploy wa-client, scan-orchestrator, control-plane separately)  
✅ Custom domain support (2 domains)  
✅ Free PostgreSQL and Redis included  
✅ Docker deployment from Dockerfile or registry  
✅ Continuous deployment from Git

**Limitations:**
⚠️ **750 hours shared** across ALL services → with 5 services, ~150 hours/month per service (only 20% uptime!)  
⚠️ **Services spin down after 15 minutes of inactivity** → 30-60s cold start latency  
⚠️ **Free PostgreSQL expires after 90 days**  
⚠️ **512MB RAM per service** (wa-client and scan-orchestrator need 1GB each)

**Verdict:** ⚠️ **NOT suitable for high-throughput, always-on WhatsApp bot** (cold starts kill real-time responsiveness)

---

### 4. **Fly.io** ⭐⭐⭐⭐ Best for Production (if you can fit)

**Free Tier Specs:**

- **3 shared-CPU 256MB VMs** (free forever)
- **3GB persistent storage**
- **160GB outbound data transfer**
- Custom domain support with automatic HTTPS
- Docker deployment with excellent support
- **New users often nudged toward $5/month Hobby plan**

**Why Fly.io:**
✅ **Always-on** (no spin-down like Render)  
✅ Excellent Docker support  
✅ Custom domains with auto-HTTPS  
✅ Global edge deployment (low latency)  
✅ PostgreSQL via **Fly Postgres** (managed extension)  
✅ Redis via **Upstash Redis** (Fly Marketplace)

**Limitations:**
⚠️ **Only 256MB RAM per VM** on free tier (you need 1GB for wa-client/scan-orchestrator)  
⚠️ **3 VMs max** (you need 5+ services)  
⚠️ New users may not have access to "always free" tier anymore (confusing documentation)

**Optimized Architecture for Fly.io:**

- **VM 1**: wa-client (256MB) → upgrade to paid 1GB instance ($5/month)
- **VM 2**: scan-orchestrator (256MB) → upgrade to paid 1GB instance ($5/month)
- **VM 3**: control-plane + reverse-proxy + uptime-kuma (combined 256MB)
- **External**: Fly Postgres (paid or separate managed service)
- **External**: Upstash Redis (free tier via Fly Marketplace)

**Verdict:** ⚠️ **Best option if you pay ~$10/month** for 2x 1GB VMs + managed DB

---

### 5. **Railway** ⭐⭐⭐ Currently What You're Using

**Free Tier Specs:**

- **$5 one-time credit** (30-day trial)
- After trial: $5/month "Hobby" plan with $5 usage credits
- **0.5GB RAM, 1 vCPU** per service
- **0.5GB volume storage**
- **1 custom domain** on trial

**Why Railway:**
✅ Already configured in your `railway.toml`  
✅ Excellent developer experience  
✅ Easy PostgreSQL and Redis provisioning  
✅ Docker deployment support

**Limitations:**
⚠️ **Free tier is just a 30-day trial**  
⚠️ **$5/month minimum** after trial (but only $5 in credits → pay-as-you-go beyond that)  
⚠️ **0.5GB RAM per service** (you need 1GB for wa-client/scan-orchestrator)

**Verdict:** ✅ **Best paid option for $10-15/month** (already set up, just scale resources)

---

### 6. **Oracle Cloud Free Tier** ⭐⭐⭐⭐⭐ Most Generous (if you can navigate it)

**Always Free Tier Specs:**

- **2 AMD VMs**: 0.25 vCPU + 1GB RAM each
- **4 Arm VMs**: 24GB RAM total, 3,000 OCPU hours/month
- **200GB block storage**
- **10GB object storage**
- **Managed PostgreSQL and Redis** (tiered pricing, basic tier may be free)

**Why Oracle Cloud:**
✅ **Most generous free tier** (24GB RAM total on Arm VMs!)  
✅ Always-on (no cold starts)  
✅ Can run entire stack on free tier  
✅ Custom domains supported  
✅ High throughput capable

**Limitations:**
⚠️ **Complex setup** (not PaaS like Render/Railway)  
⚠️ Requires manual Docker orchestration (no native Docker Compose support)  
⚠️ Arm architecture (may need multi-arch builds)  
⚠️ **Infamously hard to get approved** for free tier (credit card verification issues)  
⚠️ Can **suspend accounts aggressively** if idle

**Verdict:** ✅ **Best free tier IF you can get approved and manage complexity**

---

## 🛠️ Alternative Strategies

### Strategy 1: **Hybrid Approach** (Recommended)

Use multiple providers to maximize free tiers:

1. **Compute**: Fly.io (3x 256MB VMs for lightweight services)
2. **PostgreSQL**: [Neon](https://neon.tech) (5GB free, serverless, auto-scales)
3. **Redis**: [Upstash](https://upstash.com) (10,000 commands/day free)
4. **Monitoring (Uptime Kuma)**: Self-host on [Coolify](https://coolify.io) (free self-hosted PaaS on your own VPS)
5. **Custom Domains**: Cloudflare (free DNS + proxy)

**Total Cost:** $0/month if you have a cheapVPS for monitoring (~$5/month for a small VPS)

---

### Strategy 2: **Self-Hosted on Cheap VPS**

Deploy to a budget VPS provider:

| **Provider**     | **Specs**                 | **Price**         | **Notes**                   |
| ---------------- | ------------------------- | ----------------- | --------------------------- |
| **Hetzner**      | 4GB RAM, 2 vCPU, 40GB SSD | €4.51/month (~$5) | Best value, EU location     |
| **Contabo**      | 4GB RAM, 2 vCPU, 50GB SSD | $4.99/month       | Budget option               |
| **DigitalOcean** | 2GB RAM, 1 vCPU, 50GB SSD | $12/month         | More expensive but reliable |
| **Vultr**        | 2GB RAM, 1 vCPU, 55GB SSD | $12/month         | Similar to DigitalOcean     |

**Why VPS:**
✅ **Full control** (no cold starts, no scaling limits)  
✅ **Predictable pricing**  
✅ **High throughput** (dedicated resources)  
✅ Easy Docker Compose deployment (use your existing `docker-compose.yml`)  
✅ Custom domains via Nginx reverse proxy

**Setup:**

```bash
# On Hetzner VPS (4GB RAM, $5/month)
curl -fsSL https://get.docker.com | sh
git clone your-repo && cd whatsapp-bot-scanner
./setup.sh
# Point custom domains to VPS IP
```

**Verdict:** ✅ **Most practical for high-throughput production** ($5/month)

---

## 📊 Direct Comparison Table

| **Provider**     | **Free Tier**          | **RAM**    | **Uptime**                 | **Custom Domains**  | **Best For**   | **Verdict**          |
| ---------------- | ---------------------- | ---------- | -------------------------- | ------------------- | -------------- | -------------------- |
| **Koyeb**        | 1 service + 1 DB       | 512MB      | ❌ Scales to zero          | ✅ 5 domains        | Testing        | ❌ Not viable        |
| **Northflank**   | 2 services + 2 DBs     | Unknown    | Unknown                    | ⚠️ Unclear          | Development    | ⚠️ Testing only      |
| **Render**       | 750h/month shared      | 512MB      | ❌ Spins down (15min idle) | ✅ 2 domains        | Hobby projects | ❌ Cold starts       |
| **Fly.io**       | 3x 256MB VMs           | 256MB/VM   | ✅ Always-on               | ✅ Unlimited        | Production     | ⚠️ Need paid upgrade |
| **Railway**      | $5 trial (30 days)     | 500MB      | ✅ Always-on               | ⚠️ 1 domain (trial) | Prototyping    | ⚠️ Paid after trial  |
| **Oracle Cloud** | 4 Arm VMs (24GB total) | 24GB total | ✅ Always-on               | ✅ Supported        | Production     | ✅ **Best free**     |
| **Hetzner VPS**  | N/A (paid)             | 4GB        | ✅ Always-on               | ✅ Unlimited        | Production     | ✅ **Best value**    |

---

## 🎯 Final Recommendations

### For **High Throughput + Low Latency** (Your Priority):

1. **Best Free Option:** **Oracle Cloud Free Tier** (24GB RAM Arm VMs)
   - ⚠️ Requires effort to set up and get approved
   - ✅ Can run entire stack always-on for free

2. **Best Paid-But-Cheap Option:** **Hetzner VPS** ($5/month)
   - ✅ Easiest setup (just use your `docker-compose.yml`)
   - ✅ Predictable performance, no cold starts
   - ✅ Full control over resources

3. **Best PaaS Option:** **Fly.io** with paid VMs ($10-15/month)
   - ✅ Excellent developer experience
   - ✅ Global edge deployment
   - ✅ Managed PostgreSQL/Redis available

### For **Custom Domains on Control Plane:**

All options support custom domains, but:

- **Koyeb**: 5 domains free (most generous)
- **Render**: 2 domains free
- **Fly.io**: Unlimited domains
- **VPS**: Unlimited (configure Nginx yourself)

### For **Development/Testing:**

- **Northflank Sandbox**: Free 2 services + 2 databases (PostgreSQL + Redis)

---

## 🚀 Quick Start: Deploy to Hetzner (Recommended)

1. **Create account** at [Hetzner Cloud](https://www.hetzner.com/cloud)
2. **Spin up server**: CX22 (4GB RAM, €4.51/month)
3. **SSH into server** and run:
   ```bash
   curl -fsSL https://get.docker.com | sh
   git clone https://github.com/your-username/whatsapp-bot-scanner.git
   cd whatsapp-bot-scanner
   ./setup.sh
   ```
4. **Configure custom domains**:
   - Point DNS to server IP
   - Configure Nginx reverse proxy for Grafana, Uptime Kuma, etc.
5. **Done!** Full throughput, low latency, no cold starts.

---

## Additional Resources

- [Neon (Free PostgreSQL)](https://neon.tech) - 5GB free, serverless
- [Upstash (Free Redis)](https://upstash.com) - 10,000 commands/day
- [Coolify (Self-hosted PaaS)](https://coolify.io) - Deploy like Heroku on your own server
- [Cloudflare (Free CDN/DNS)](https://cloudflare.com) - Proxy + custom domains
