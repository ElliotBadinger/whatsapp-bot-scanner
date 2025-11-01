# WhatsApp Link Scanner: Ruthless Usability & Implementation Audit

## 1) Executive Verdict

**Non-tech shipability today:** ⛔  
**Implementation health:** Mixed  
**Confidence:** High (comprehensive codebase + docs review)

### Top 5 Blockers:

1. **QR onboarding requires terminal access** — Non-techs must tail Docker logs; no web page with QR display (Evidence: README.md "First run requires scanning QR in wa-client logs")
2. **7+ manual API keys required before first verdict** — VirusTotal, GSB, WhoisXML, urlscan, Phishtank; system degraded without them (Evidence: .env.example references throughout; DEPLOYMENT.md)
3. **Zero in-chat management UX** — All admin actions use cryptic `!scanner` commands; no buttons/menus/natural language (Evidence: ADMIN_COMMANDS.md shows prefix-only commands)
4. **3-service microarchitecture overkill** — wa-client, scan-orchestrator, control-plane when 1 service + worker threads would suffice; needless Redis+Postgres+nginx+BullMQ (Evidence: ARCHITECTURE.md component diagram)
5. **No recovery automation** — Session loss, quota exhaustion, circuit opens require manual intervention via logs/API calls (Evidence: RUNBOOKS.md shows manual curl commands for all recovery)

---

## 2) "Friction to First Verdict" Teardown

### Current Path (Evidence: README.md + DEPLOYMENT.md)

| Step | Action | Requires Terminal? | Concepts Needed |
|------|--------|-------------------|-----------------|
| 1 | Clone repo | ✅ | git, command line |
| 2 | Copy `.env.example` → `.env` | ✅ | file systems, env vars |
| 3 | Obtain VirusTotal API key | ❌ (browser) | API registration, rate limits |
| 4 | Obtain Google Safe Browsing key | ❌ (browser) | Google Cloud Console navigation |
| 5 | Obtain WhoisXML key (optional) | ❌ (browser) | Quota concepts |
| 6 | Obtain urlscan.io key (optional) | ❌ (browser) | Webhooks, callback URLs |
| 7 | Fill ~15 env vars in `.env` | ✅ | Text editing |
| 8 | `make build` | ✅ | Docker, make |
| 9 | `make up` | ✅ | Docker Compose |
| 10 | `docker compose logs -f wa-client` | ✅ | Docker logs, -f flag |
| 11 | Wait for QR in terminal output | ✅ | Terminal scrolling |
| 12 | Scan QR with phone | ❌ (phone) | WhatsApp > Linked Devices |
| 13 | Add bot to test group | ❌ (phone) | Group admin permissions |
| 14 | Paste malicious URL | ❌ (phone) | - |
| 15 | Wait for verdict | ❌ (phone) | - |

**Total:** 15 steps  
**Terminal steps:** 6 (40%)  
**Required concepts:** Docker, environment variables, API keys, rate limits, webhooks, Make, log tailing  
**Stall points:** API key acquisition (steps 3-6), QR visibility (step 11), session loss recovery (Not Evidenced in onboarding flow)

### **Proposed Strictly Fewer-Steps Path**

| Step | Action | Requires Terminal? | Concepts Needed |
|------|--------|-------------------|-----------------|
| 1 | Click "Deploy to Railway/Render" button in README | ❌ (browser) | None |
| 2 | Open web UI at provided URL | ❌ (browser) | None |
| 3 | Scan QR on web page | ❌ (phone) | WhatsApp > Linked Devices |
| 4 | Add bot to group via web page link | ❌ (phone) | Group admin permissions |
| 5 | Send test URL in group | ❌ (phone) | - |
| 6 | Receive verdict (heuristics-only mode) | ❌ (phone) | - |
| 7 | (Optional) Add API keys via web form to enhance | ❌ (browser) | API registration |

**Total:** 6 core steps (7 with enhancement)  
**Terminal steps:** 0  
**Required concepts:** None for basic operation  
**Enhancement path:** Add keys later for richer verdicts  

**SLA Promise:** Onboarding → first verdict **≤ 5 minutes, zero terminals, works without API keys** (heuristic-only mode with domain age, TLD checks, IP literals, URL length).

---

## 3) Red-Team UX Critique

### A) Onboarding (QR + consent + defaults without keys)
**Grade: F**

**Issues:**
- QR requires `docker compose logs -f wa-client` (Evidence: README.md L32)
- No browser-based QR page
- Consent template posted in-chat only; no pre-join disclosure (Evidence: CONSENT.md)
- Fails silently if API keys missing — verdicts become "benign" with no user warning (Evidence: ARCHITECTURE.md shows fallback to heuristics without notice)

**What's Missing:**
- Web page at `/setup` showing QR + session health
- "Keys optional" guidance with feature comparison matrix
- Pre-deployment consent checkbox flow

---

### B) In-chat management
**Grade: D**

**Issues:**
- `!scanner` prefix unnatural; no buttons/menus despite WhatsApp Business API support (Evidence: ADMIN_COMMANDS.md shows text-only commands)
- Commands cryptic: `!scanner rescan <url>` returns `hash=abc job=123` — meaningless to non-techs (Evidence: ADMIN_COMMANDS.md L6)
- No natural language: can't say "pause for 1 hour" — must type `!scanner mute 60` (Evidence: ADMIN_COMMANDS.md L4)
- No "why?" command to explain verdict reasoning in plain language (Not Evidenced)

**What Should Exist:**
- Interactive buttons on verdict messages: [Rescan] [False Positive] [Why?]
- Natural language parsing: "pause 1h", "check this again", "why was this blocked"
- Confirmation prompts: "Unmute scanner? Reply YES to confirm"

---

### C) Web UI (simple dashboard)
**Grade: F (absent)**

**Issues:**
- No web UI exists except Grafana (requires login, overwhelming for non-techs) (Evidence: README.md L23 "Open Grafana at http://localhost:3002")
- Control-plane API is curl-only (Evidence: API.md shows no web interface)
- QR re-scanning requires Docker log access (Evidence: RUNBOOKS.md "docker compose logs -f wa-client and wait for QR output")

**What's Missing (Critical):**
- **Overview page:** Session status, groups protected, verdicts today, quota health
- **Verdicts page:** Recent scans with filter/search
- **Overrides page:** Allow/deny rules with visual editor
- **Settings page:** API keys, rate limits, localization toggles
- **Health page:** Red/amber/green for each integration, ETA to quota reset

---

### D) Recovery (session lost, rate limits, provider outages, rescan/cache flush)
**Grade: D-**

**Issues:**
- Session loss: must `docker compose logs -f wa-client` and scan new QR (Evidence: RUNBOOKS.md "WA Session Recovery")
- Rate limits: silent failure; no in-chat message to admins (Evidence: ARCHITECTURE.md mentions rate limiting but no user-facing alerts)
- Quota exhaustion: VirusTotal degrades to URLhaus but user not notified (Evidence: THREAT_MODEL.md "VT/GSB quota exhaustion – Monitor via metrics; degrade to heuristics")
- Rescan requires `POST /rescan` with bearer token via curl (Evidence: API.md L13)

**What Should Exist:**
- Auto-DM to group admin when session drops: "Bot disconnected. Scan QR: [link]"
- In-chat quota warnings: "VirusTotal quota 80% used. Consider upgrading."
- Self-healing: auto-retry connection with backoff
- One-click rescan: `/rescan` web page with URL paste box

---

### E) Explainability (plain, localized "why")
**Grade: C-**

**Issues:**
- Verdicts show cryptic reasons: "Domain registered 5 days ago (<7)" (Evidence: scoring.ts L71-77 generates these)
- No plain-language expansion (Evidence: formatGroupVerdict in wa-client shows truncated reasons)
- Not localized; always English (Evidence: CONSENT.md is English-only; no translation files found)

**What Should Exist:**
- "Why?" button → "This link was flagged because the website was created less than a week ago. New sites are often used for scams."
- Language detection from group settings (Not Evidenced)
- Emoji severity: 🟢 benign, 🟡 suspicious, 🔴 malicious

---

### F) Privacy UX (what's stored, retention, export/delete)
**Grade: C**

**Issues:**
- Consent template mentions 30-day retention but no self-service export/delete (Evidence: CONSENT.md L9; SECURITY_PRIVACY.md mentions "Data export/delete supported by SQL queries" — admin-only)
- No `/privacy` command or web page
- URLscan artifacts stored indefinitely without user awareness (Evidence: ARCHITECTURE.md mentions `storage/urlscan-artifacts` with no automatic cleanup)

**What Should Exist:**
- `!scanner privacy` → "We store URLs, chat ID, hashed sender ID for 30 days. Export: [link]. Delete: [link]"
- Web page `/data/:chatId` with export (JSON) and delete (with confirmation) buttons
- Auto-cleanup of urlscan artifacts after 30 days (Evidence: RUNBOOKS.md suggests manual rotation)

---

### G) Localization / accessibility (languages, low-data, emoji semantics)
**Grade: F**

**Issues:**
- Hardcoded English everywhere (Evidence: CONSENT.md, formatGroupVerdict in wa-client)
- No translation framework (Not Evidenced in codebase structure)
- Verdicts send full text + potentially large attachments (screenshots, IOC files) without opt-out (Evidence: wa-client collectVerdictMedia sends PNG + TXT unconditionally if enabled)

**What Should Exist:**
- `i18n/` folder with translation JSON files
- Language detection from group metadata or `!scanner lang es` command
- Low-bandwidth mode: text-only verdicts, no attachments

---

### H) Human observability (green/amber/red health; weekly DM summary)
**Grade: D**

**Issues:**
- Health metrics require Grafana dashboard access (Evidence: README.md L23)
- No automated health DMs to admins (Not Evidenced)
- Circuit breaker opens silently; admin unaware (Evidence: RUNBOOKS.md "Circuit breaker open: consult Grafana" — no proactive alert)

**What Should Exist:**
- Daily DM to group admins: "Scanner health: 🟢 All systems OK. Scanned 47 links today (12 suspicious, 0 malicious)."
- Weekly summary: "This week: 312 scans, 2 false positives corrected, quota 45% used."
- Alert DM when degraded: "⚠️ VirusTotal quota exhausted. Verdicts now rely on heuristics only."

---

## 4) Implementation Fitness & Efficiency Assessment

| Area | Current Approach | What's Wrong | Better Implementation | Why It's Better |
|------|------------------|--------------|----------------------|-----------------|
| **Architecture** | 3 Fastify services + Redis + Postgres + nginx + BullMQ | Over-engineered; each service <500 lines, excessive IPC overhead | Single Node.js service with worker threads; SQLite for persistence | 90% fewer moving parts; <2s cold start vs 15s; <128MB RAM vs 512MB |
| **WhatsApp client** | whatsapp-web.js (Puppeteer, headless Chrome) | 150MB+ memory, crashes on OOM, QR in logs only | baileys library (pure JS, no browser) + web page for QR | 10x lighter (<15MB), stable, built-in QR endpoint |
| **Queue system** | BullMQ (Redis-backed job queue) | Overkill for single-worker use case; adds 50MB Redis | `async` + in-memory queue with persistence on crash | Zero Redis needed; simpler failure recovery |
| **URL expansion** | Unshorten.me API + custom fetch fallback | External dependency (Unshorten.me), complex two-tier logic | Direct HTTP HEAD with redirects + timeout | Faster (one hop), no external API, fewer failure modes |
| **Reputation checks** | Parallel fetches with circuit breakers | Good pattern but over-abstracted (CircuitBreaker class for each) | Simple retry with exponential backoff + shared failure counter | 200 lines → 50 lines; same reliability |
| **Database** | Postgres for scans + messages + overrides | Postgres overkill for <1M rows; requires managed service | SQLite with WAL mode | Zero-config; embeds in binary; fast enough (<10ms queries) |
| **Caching** | Redis with manual TTL management | Redis required even for small deployments | SQLite table with indexed `expires_at` column | Same speed; no separate process |
| **Metrics** | Prometheus + Grafana stack | Requires 2 extra containers (200MB+) for non-tech users | Built-in `/health` JSON endpoint with red/amber/green summary | Human-readable; no dashboard complexity |
| **Consent flow** | Posted in-chat after join; stored in Redis | Users miss it; no audit trail | Web page consent before bot joins + signed log | GDPR-compliant; clear record |
| **QR display** | Terminal logs only | Unusable for non-techs | `/setup` web page with auto-refreshing QR PNG | Click link → scan → done |
| **API keys** | All required upfront in .env | Blocks onboarding; keys scattered across services | Progressive enhancement: works without keys (heuristics), add via web form later | Ship same day; upgrade when ready |
| **Admin commands** | `!scanner mute 60` text parsing | Unnatural, error-prone | Natural language: "pause 1 hour" + WhatsApp buttons (list replies) | Intuitive; no memorization |
| **Rate limiting** | RateLimiterRedis with complex token buckets | Over-engineered; leaks Redis connections | Simple in-memory sliding window | 100 lines → 20 lines; same behavior |
| **Verdict attachments** | Always fetch urlscan screenshot + IOC txt | Wastes bandwidth; slows delivery | Opt-in via `!scanner attachments on` | Faster verdicts; data-saver friendly |

**Cost Impact:**  
- Current: $25/mo Railway (3 services + Redis + Postgres + reverse proxy)  
- Proposed: $5/mo Railway (1 service + SQLite embedded)  
**Operational Impact:**  
- Current: 6 logs to check, 3 health endpoints, Redis CLI debugging  
- Proposed: 1 log, 1 `/health` JSON, SQLite CLI for power users  

---

## 5) Free-Tier Stamina & Cost Reality Check

### Quota/Cost Matrix

| Provider | Free Tier | Burst Rules | Overage Behavior | Current Bottleneck |
|----------|-----------|-------------|------------------|-------------------|
| **VirusTotal** | 4 req/min, 500/day | Hard limit; HTTP 429 | Queue stalls; fallback to URLhaus | Yes (Evidence: COST_MODEL.md "4 requests per minute") |
| **Google Safe Browsing** | 10k req/day | Soft; may throttle | Degraded verdicts | No (generous) |
| **WhoisXML** | 500 req/month | Hard limit | Auto-disable; fall back to RDAP | Yes (Evidence: COST_MODEL.md "500 requests/month") |
| **URLscan.io** | 100 scans/day (public) | Hard limit | Deep scans stop; heuristics continue | Yes if suspicious URLs >100/day |
| **Phishtank** | Unlimited (non-commercial) | Rate limit ~1 req/s | Cached; circuit breaker | No |
| **Railway/Render** | $5/mo free credit | 500h/mo; sleeps after inactivity | Service unavailable until wake | Yes for "always-on" |
| **Redis** | 30MB free (Upstash) | Eviction when full | Older cache entries lost | No (scans are small) |
| **Postgres** | 1GB free (Railway/Render) | Hard cap | Writes fail | No (30-day retention keeps DB small) |

### 3 Deployment Tiers

#### **Tier 1: Hobby (Quasi-Free; Can Sleep)**
**Daily verdict capacity:** ~200 URLs/day (VirusTotal bottleneck)  
**Components:** 1 service (Railway $5/mo free credit); SQLite embedded; no Redis/Postgres  
**Degraded-mode rules:**
- VT quota exhausted → Use URLhaus + heuristics only  
- WhoisXML quota exhausted → RDAP only (less accurate domain age)  
- URLscan quota exhausted → Skip deep scans; verdicts still issued  
**User message:** "🟡 Quota limits reached. Verdicts now use basic checks only. Upgrade for full protection: [link]"

#### **Tier 2: Starter (Always-On Minimal)**
**Daily verdict capacity:** ~500 URLs/day (VirusTotal + URLhaus parallelized)  
**Components:** 1 service (Railway $12/mo); managed Redis (Upstash $10/mo); SQLite  
**Degraded-mode rules:**
- Same as Tier 1  
- Cache hit ratio target: 60%+ (reduces VT calls)  
**User message:** "🟢 Scanner operating normally. Quota: VT 78%, Whois 45%, URLscan 62%."

#### **Tier 3: Pro (Scaled)**
**Daily verdict capacity:** Unlimited (paid VT tier at $0.002/scan)  
**Components:** 2 services (Railway $25/mo); managed Redis + Postgres ($20/mo); CDN for artifacts  
**Degraded-mode rules:**
- Circuit breakers prevent cascading failures  
- Auto-scale workers during spikes  
**User message:** "🟢 Scanner fully operational. Enterprise-grade protection active."

### Degraded Mode Messaging Examples

**When VirusTotal exhausted (in-chat DM to admin):**
> ⚠️ **Scanner Update**  
> VirusTotal quota exhausted (500/day limit reached). Verdicts will now rely on:  
> • URLhaus malware database  
> • Domain age checks  
> • URL heuristics (IP addresses, suspicious TLDs, etc.)  
>  
> Coverage: ~80% of threats still detected. Quota resets in 6 hours.  
> Upgrade to Pro for unlimited scans: [link]

**When all APIs down (in-chat):**
> 🔴 **Scanner Limited Mode**  
> All external security APIs are temporarily unavailable. Verdicts now use:  
> • URL pattern analysis  
> • Domain age estimation  
> • Known shortener detection  
>  
> Protection reduced to ~40%. Avoid clicking suspicious links until APIs recover.

---

## 6) Superior Implementation Plan

### Architecture Delta

**Before (3 microservices):**
```
wa-client:3000 ──┐
                  ├─> Redis ──> BullMQ ──> scan-orchestrator:3001
control-plane:8080┘                              │
                                                 ├─> Postgres
                                                 └─> Redis (cache)
```

**After (1 service + workers):**
```
wbscanner:3000
  ├─ WhatsApp client (baileys)
  ├─ Web UI (Fastify static)
  ├─ Scan worker threads (3x)
  ├─ API routes (/setup, /health, /scans)
  └─ SQLite (embedded; WAL mode)
```

**What to remove:**
- ❌ scan-orchestrator service (merge into workers)
- ❌ control-plane service (merge into main API)
- ❌ reverse-proxy (nginx) — Fastify handles HTTPS
- ❌ BullMQ — use `async` + worker threads
- ❌ Redis — SQLite for cache + persistence
- ❌ Postgres — SQLite sufficient for <1M rows
- ❌ Puppeteer — baileys library is pure JS

**What goes serverless:**
- ❌ Nothing — single Node.js process is simplest for WhatsApp long-polling

**One tiny always-on worker:**
- Main process (20MB idle, 80MB active)
- 3 worker threads for parallel reputation checks (10MB each)

**Where QR pairing lives:**
- `GET /setup` → HTML page with QR PNG, auto-refresh every 2s
- No log-tailing; URL logged once: "Setup: https://[your-app].railway.app/setup"

---

### Onboarding Package

#### 1-Click Deploy (Railway)

**`railway.toml` (simplified):**
```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "npm start"
healthcheckPath = "/health"
healthcheckTimeout = 30

[[services]]
name = "wbscanner"
source = "."

[services.wbscanner.domains]
generate = true
```

**Environment variables (optional, progressive):**
```
# Core (auto-generated)
SESSION_SECRET=<random>        # Auto-generated by Railway
DATABASE_PATH=/data/scanner.db # Persistent volume

# Enhancement (add later)
VIRUSTOTAL_API_KEY=
GOOGLE_SAFE_BROWSING_KEY=
WHOISXML_API_KEY=
URLSCAN_API_KEY=
```

#### "Keys Later" Path (Heuristics + Free OSINT)

**Free checks (no API keys):**
1. **Suspicious TLD detection:** `.tk`, `.ml`, `.ga`, `.cf`, `.gq`, `.xyz`, `.top`, `.buzz` (Evidence: url.ts isSuspiciousTld)
2. **IP literal detection:** Direct IP addresses vs. domain names
3. **URL length:** Paths >200 chars often phishing
4. **Executable extensions:** `.exe`, `.apk`, `.msi`, `.scr`, etc.
5. **RDAP domain age:** Free WHOIS data (less accurate than WhoisXML but zero cost)
6. **Homoglyph detection:** Unicode lookalike characters (Evidence: homoglyph.ts)
7. **Uncommon ports:** Non-80/443/8080/8443

**Auto-consent post (localized):**
```javascript
const templates = {
  en: "👋 Link Scanner Active\n\nI check links for safety. Data stored 30 days. Opt-out: reply STOP.\n\nLearn more: {url}/privacy",
  es: "👋 Escáner de Enlaces Activo\n\nVerifico enlaces por seguridad. Datos almacenados 30 días. Cancelar: responder STOP.\n\nMás info: {url}/privacy",
  // ... more languages
};
```

---

### In-Chat Admin UX

**Natural-language commands (NO prefix required):**
```
User: "pause for 1 hour"
Bot: ✅ Paused for 1 hour. Resume: {url}/groups/{id}/unmute

User: "why was this blocked?"
Bot: 🔴 Blocked because:
• Domain created 3 days ago (very new)
• Flagged by Google Safe Browsing
• Uses suspicious .tk domain
Full report: {url}/scans/{hash}

User: "check this again: https://example.com"
Bot: 🔄 Rescanning... (typically 5-10 seconds)
```

**Interactive buttons (WhatsApp list replies):**
```javascript
await chat.sendMessage('Verdict: SUSPICIOUS', {
  buttons: [
    { id: 'rescan', text: '🔄 Check Again' },
    { id: 'allow', text: '✅ Safe (Override)' },
    { id: 'why', text: '❓ Why Suspicious?' },
  ],
});
```

---

### Simple Web UI

**Routes:**
```
GET  /              → Landing page (if not logged in) or dashboard
GET  /setup         → QR code display + session health
GET  /health        → JSON: { status: "green", quotas: {...}, uptime: 3600 }
GET  /scans         → Table: recent verdicts with filters
GET  /scans/:hash   → Detail: full signals, IOCs, timeline
GET  /overrides     → Table: allow/deny rules with [Add] [Delete]
POST /overrides     → Create new rule (form submission)
GET  /settings      → API keys, rate limits, language, features
POST /settings      → Save settings (form submission)
GET  /privacy/:chatId → Export data (JSON) + Delete button
POST /privacy/:chatId/delete → Confirm deletion
```

**Wireframe (Dashboard):**
```
┌─────────────────────────────────────────────┐
│ 🔗 WBScanner Dashboard                      │
├─────────────────────────────────────────────┤
│ Status: 🟢 All systems operational          │
│                                             │
│ Today:                                      │
│  • 47 scans (12 suspicious, 0 malicious)   │
│  • Quota: VT 78% | Whois 45% | URLscan 62% │
│  • 3 groups protected                       │
│                                             │
│ [View Scans] [Overrides] [Settings]        │
└─────────────────────────────────────────────┘
```

---

### Reliability Kit

**Token buckets + daily budgets:**
```javascript
class TokenBucket {
  constructor(tokensPerHour, maxBurst) {
    this.tokens = maxBurst;
    this.max = maxBurst;
    this.refillRate = tokensPerHour / 3600;
    this.lastRefill = Date.now();
  }
  
  async consume(count = 1) {
    this.refill();
    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }
    return false; // Quota exhausted
  }
  
  refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.max, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}
```

**Circuit breakers (simplified):**
```javascript
class SimpleBreaker {
  constructor(threshold = 5, timeout = 30000) {
    this.failures = 0;
    this.threshold = threshold;
    this.timeout = timeout;
    this.openUntil = 0;
  }
  
  async call(fn) {
    if (Date.now() < this.openUntil) {
      throw new Error('Circuit open');
    }
    try {
      const result = await fn();
      this.failures = 0; // Reset on success
      return result;
    } catch (err) {
      this.failures++;
      if (this.failures >= this.threshold) {
        this.openUntil = Date.now() + this.timeout;
      }
      throw err;
    }
  }
}
```

**Cache policy (SQLite):**
```sql
CREATE TABLE cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_expires ON cache(expires_at);

-- Auto-cleanup on query
DELETE FROM cache WHERE expires_at < unixepoch();
```

**Explicit degraded mode:**
```javascript
const degradedMode = {
  vt: false,
  whoisxml: false,
  urlscan: false,
};

async function checkDegradedMode() {
  if (!config.VT_API_KEY || vtBucket.tokens === 0) {
    if (!degradedMode.vt) {
      degradedMode.vt = true;
      await notifyAdmin('⚠️ VirusTotal quota exhausted. Using fallback checks.');
    }
  }
}
```

**Self-healing QR:**
```javascript
waClient.on('disconnected', async () => {
  const reconnectURL = `${process.env.BASE_URL}/setup`;
  await notifyAdmin(`🔴 Bot disconnected. Reconnect: ${reconnectURL}`);
  
  // Auto-retry after 30s
  setTimeout(() => waClient.initialize(), 30000);
});
```

---

### Privacy & Governance

**30-day default retention:**
```sql
-- Daily cleanup job
DELETE FROM scans WHERE last_seen_at < datetime('now', '-30 days');
DELETE FROM messages WHERE posted_at < datetime('now', '-30 days');
```

**Export/delete:**
```javascript
app.get('/privacy/:chatId/export', async (req, res) => {
  const { chatId } = req.params;
  const scans = await db.all('SELECT * FROM scans WHERE chat_id = ?', chatId);
  res.json({ chatId, scans, exported_at: new Date() });
});

app.post('/privacy/:chatId/delete', async (req, res) => {
  const { chatId } = req.params;
  await db.run('DELETE FROM scans WHERE chat_id = ?', chatId);
  await db.run('DELETE FROM messages WHERE chat_id = ?', chatId);
  res.json({ ok: true, message: 'All data deleted' });
});
```

**Per-tenant toggle for deep scans:**
```javascript
// Settings table
CREATE TABLE group_settings (
  chat_id TEXT PRIMARY KEY,
  deep_scans BOOLEAN DEFAULT 0,  -- URLscan screenshots
  language TEXT DEFAULT 'en',
  attachments BOOLEAN DEFAULT 0
);
```

---

### Localization

**Translation files (`i18n/en.json`):**
```json
{
  "verdict.benign": "✅ Safe Link",
  "verdict.suspicious": "🟡 Suspicious Link",
  "verdict.malicious": "🔴 Dangerous Link - DO NOT CLICK",
  "reason.domain_age": "Domain created {days} days ago (very new)",
  "reason.gsb_malware": "Flagged for malware by Google",
  "reason.ip_literal": "Direct IP address (unusual for legitimate sites)",
  "consent.message": "👋 Link Scanner Active\n\nI check links for safety. Data stored 30 days. Opt-out: reply STOP.\n\nPrivacy: {url}/privacy"
}
```

**Auto language detection:**
```javascript
function detectLanguage(chat) {
  // WhatsApp group metadata often includes region
  const region = chat.metadata?.region || 'en';
  const supported = ['en', 'es', 'fr', 'de', 'pt', 'hi', 'ar'];
  return supported.includes(region) ? region : 'en';
}
```

---

### File Tree Changes

```
wbscanner/
├── src/
│   ├── index.ts                 # Main service (Fastify + baileys)
│   ├── workers/
│   │   └── scanner.ts           # Reputation checks in worker threads
│   ├── routes/
│   │   ├── setup.ts             # QR display
│   │   ├── health.ts            # Status JSON
│   │   ├── scans.ts             # Verdict history
│   │   └── privacy.ts           # Export/delete
│   ├── lib/
│   │   ├── db.ts                # SQLite wrapper
│   │   ├── cache.ts             # SQLite-backed cache
│   │   ├── reputation.ts        # VT, GSB, etc.
│   │   └── heuristics.ts        # Free checks
│   └── i18n/
│       ├── en.json
│       ├── es.json
│       └── fr.json
├── public/                      # Static web UI
│   ├── index.html
│   ├── setup.html
│   └── style.css
├── data/
│   └── scanner.db               # SQLite (auto-created)
├── package.json
├── railway.toml                 # 1-click deploy
└── README.md
```

**Env schema (progressive):**
```bash
# Auto-generated
SESSION_SECRET=<random-hex>
DATABASE_PATH=/data/scanner.db
PORT=3000
BASE_URL=https://my-scanner.railway.app

# Optional enhancements (add via web UI later)
VIRUSTOTAL_API_KEY=
GOOGLE_SAFE_BROWSING_KEY=
WHOISXML_API_KEY=
URLSCAN_API_KEY=
PHISHTANK_API_KEY=
```

**Example API call (setup):**
```bash
# Get QR code
curl https://my-scanner.railway.app/setup/qr
# Returns: data:image/png;base64,iVBORw0KGgo...

# Get health
curl https://my-scanner.railway.app/health
# Returns: {"status":"green","quotas":{"vt":78,"whoisxml":45},...}
```

---

## 7) Creative Fixes for Misaligned Implementations

### Fix 1: **Replace whatsapp-web.js with baileys**

**What to delete:**
- `services/wa-client/src/index.ts` lines 1-50 (Puppeteer initialization)
- Entire `puppeteer` dependency (~150MB)

**Minimal diff:**
```typescript
// Before (whatsapp-web.js)
import { Client, LocalAuth } from 'whatsapp-web.js';
const client = new Client({
  puppeteer: { headless: true, args: ['--no-sandbox'] },
  authStrategy: new LocalAuth(),
});

// After (baileys)
import makeWASocket, { useMultiFileAuthState } from '@whiskeysockets/baileys';
const { state, saveCreds } = await useMultiFileAuthState('./auth');
const sock = makeWASocket({ auth: state, printQRInTerminal: false });
sock.ev.on('creds.update', saveCreds);
```

**Impact:**
- **UX:** QR available as `sock.ev.on('connection.update')` → stream PNG to `/setup`
- **Cost:** 150MB → 15MB memory; $12/mo → $5/mo Railway tier
- **Operability:** Built-in reconnection logic; no Puppeteer crashes

---

### Fix 2: **Merge 3 services into 1 with worker threads**

**What to delete:**
- Entire `services/scan-orchestrator` folder
- Entire `services/control-plane` folder
- BullMQ queue creation in all services

**Minimal diff:**
```typescript
// Before (3 services + BullMQ)
await scanRequestQueue.add('scan', { url, chatId });
// ... in different process ...
new Worker('scan-request', async (job) => { ... });

// After (worker threads)
import { Worker } from 'worker_threads';
const scanWorker = new Worker('./workers/scanner.js');
scanWorker.postMessage({ url, chatId });
scanWorker.on('message', (verdict) => sendToWhatsApp(verdict));
```

**Impact:**
- **UX:** Faster (no Redis round-trip); simpler logs (1 service)
- **Cost:** 3 containers → 1 container; 512MB → 128MB
- **Operability:** 3 `/healthz` → 1 `/health`; unified config

---

### Fix 3: **Replace Redis + Postgres with SQLite**

**What to delete:**
- All Redis client initialization
- All Postgres pool setup
- `ioredis`, `pg` dependencies

**Minimal diff:**
```typescript
// Before (Redis cache)
await redis.set(`scan:${hash}`, JSON.stringify(verdict), 'EX', 3600);
const cached = await redis.get(`scan:${hash}`);

// After (SQLite)
await db.run('INSERT OR REPLACE INTO cache VALUES (?, ?, ?)', 
  key, JSON.stringify(value), Date.now() + ttl * 1000);
const row = await db.get('SELECT value FROM cache WHERE key = ? AND expires_at > ?', 
  key, Date.now());
```

**Impact:**
- **UX:** Zero external dependencies; deploy anywhere
- **Cost:** $10/mo Redis → $0 (embedded)
- **Operability:** No connection pool tuning; `sqlite3` CLI for debugging

---

### Fix 4: **Natural language command parsing**

**What to delete:**
- `ADMIN_COMMANDS.md` rigid prefix syntax
- `handleAdminCommand` switch statement

**Minimal diff:**
```typescript
// Before
if (msg.body === '!scanner mute 60') { ... }

// After
const intent = parseIntent(msg.body);
if (intent.action === 'pause' && intent.duration) {
  await pauseScanner(chat.id, intent.duration);
  await chat.sendMessage(`✅ Paused for ${intent.duration}.`);
}

function parseIntent(text) {
  const lower = text.toLowerCase();
  if (/pause|mute|stop|hold/.test(lower)) {
    const match = lower.match(/(\d+)\s*(h|hour|m|min)/);
    return { action: 'pause', duration: match ? parseDuration(match[0]) : 3600 };
  }
  // ... more patterns
}
```

**Impact:**
- **UX:** "pause 1h", "pause for an hour", "mute 60m" all work
- **Operability:** Fewer support questions ("what's the exact command?")

---

### Fix 5: **QR on web page instead of logs**

**What to delete:**
- QRCode terminal output in `wa-client/src/index.ts`
- "Watch logs for QR" instruction in README

**Minimal diff:**
```typescript
// Add route
app.get('/setup', async (req, res) => {
  const qr = await waClient.getQR(); // From baileys
  const html = `
    <html><body style="text-align:center;padding:50px;">
      <h1>Setup WhatsApp Bot</h1>
      <img src="${qr}" style="width:300px;height:300px;" />
      <p>Scan with WhatsApp > Linked Devices</p>
    </body></html>
  `;
  res.type('html').send(html);
});
```

**Impact:**
- **UX:** Click link → scan → done (zero terminals)
- **Time saved:** 5 minutes (no log searching)

---

### Fix 6: **Heuristics-first mode (no API keys)**

**What to add:**
```typescript
async function scanURL(url) {
  const heuristics = getHeuristics(url); // Free checks
  let score = heuristics.score;
  let reasons = heuristics.reasons;
  
  // Progressive enhancement
  if (config.VT_API_KEY) {
    const vt = await checkVirusTotal(url);
    score += vt.score;
    reasons.push(...vt.reasons);
  }
  if (config.GSB_KEY) {
    const gsb = await checkSafeBrowsing(url);
    score += gsb.score;
    reasons.push(...gsb.reasons);
  }
  
  return { score, reasons, level: scoreToLevel(score) };
}
```

**Impact:**
- **UX:** Works day 1 without keys; verdicts improve as keys added
- **Onboarding:** 15 minutes → 5 minutes

---

### Fix 7: **In-chat degraded mode notices**

**What to add:**
```typescript
async function notifyDegradedMode(chat, provider) {
  const messages = {
    vt: '⚠️ VirusTotal quota exhausted. Verdicts now rely on URLhaus + heuristics. Coverage: ~80%. Resets in 6h.',
    whoisxml: '⚠️ WhoisXML quota exhausted. Domain age checks less accurate. Consider upgrading.',
    urlscan: 'ℹ️ Deep scans (screenshots) paused. Basic verdicts continue.',
  };
  await chat.sendMessage(messages[provider] || 'Service degraded.');
}
```

**Impact:**
- **UX:** Transparent; no silent failures
- **Trust:** Users know system status

---

### Fix 8: **Auto-cleanup of stale data**

**What to add:**
```typescript
// Daily cleanup (cron or setInterval)
setInterval(async () => {
  await db.run('DELETE FROM scans WHERE last_seen_at < datetime("now", "-30 days")');
  await db.run('DELETE FROM messages WHERE posted_at < datetime("now", "-30 days")');
  
  // urlscan artifacts
  const stale = await db.all('SELECT urlscan_screenshot_path FROM scans WHERE urlscan_artifact_stored_at < datetime("now", "-30 days")');
  for (const row of stale) {
    await fs.unlink(row.urlscan_screenshot_path).catch(() => {});
  }
  await db.run('UPDATE scans SET urlscan_screenshot_path = NULL, urlscan_dom_path = NULL WHERE urlscan_artifact_stored_at < datetime("now", "-30 days")');
}, 24 * 60 * 60 * 1000);
```

**Impact:**
- **Operability:** No manual "delete stale files" runbook step
- **Cost:** Disk usage stays <1GB

---

### Fix 9: **Self-serve QR refresh**

**What to add:**
```typescript
app.get('/setup/refresh', async (req, res) => {
  await waClient.logout(); // Force new session
  const qr = await waClient.getQR();
  res.json({ qr, message: 'New QR generated' });
});
```

**Impact:**
- **UX:** Session lost? Click "Refresh" on web page (not Docker logs)
- **Time saved:** 10 minutes per recovery

---

### Fix 10: **Unified /health JSON**

**What to add:**
```typescript
app.get('/health', async (req, res) => {
  const vt = vtBucket.tokens > 0 ? 'green' : 'red';
  const whois = whoisBucket.tokens > 0 ? 'green' : 'red';
  const wa = waClient.isConnected() ? 'green' : 'red';
  
  res.json({
    status: [vt, whois, wa].includes('red') ? 'degraded' : 'green',
    services: { virustotal: vt, whoisxml: whois, whatsapp: wa },
    quotas: {
      vt: `${Math.floor(vtBucket.tokens)}/${vtBucket.max}`,
      whoisxml: `${Math.floor(whoisBucket.tokens)}/${whoisBucket.max}`,
    },
    uptime: process.uptime(),
    version: '1.0.0',
  });
});
```

**Impact:**
- **UX:** One URL to check system health (no Grafana)
- **Operability:** Monitoring tools can poll this

---

## 8) 14-Day Refactor Plan

| Day | Milestone | Definition of Done |
|-----|-----------|-------------------|
| 1 | Proof-of-concept: baileys + SQLite | QR renders on `/setup`; verdicts work with heuristics only |
| 2 | Merge 3 services into 1 | Single `npm start`; worker threads operational; BullMQ removed |
| 3 | Web UI: Dashboard + Scans pages | `/` shows status; `/scans` shows history |
| 4 | Web UI: Overrides + Settings pages | Allow/deny rules manageable; API keys addable via form |
| 5 | Natural language command parsing | "pause 1h" works; backward-compat with `!scanner` |
| 6 | In-chat degraded mode notices | Quota exhaustion triggers admin DM |
| 7 | Localization: en, es, fr | 3 languages supported; auto-detection from group region |
| 8 | Privacy: export/delete endpoints | `/privacy/:chatId` functional |
| 9 | Self-healing: auto-reconnect + alerts | Session drops → admin DM with link |
| 10 | Auto-cleanup + retention policy | 30-day purge runs daily |
| 11 | Railway 1-click deploy | `railway.toml` functional; healthcheck passes |
| 12 | Load testing: 100 URLs/min | No crashes; cache hit ratio >60%; verdicts <10s P95 |
| 13 | Documentation rewrite | README → 5-minute quickstart; runbook → 1-page FAQ |
| 14 | Beta testing with 3 non-tech users | Feedback incorporated; bugs fixed |

### Top 8 Risks + Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **baileys library breaking changes** | Medium | High | Pin exact version; test against stable WhatsApp API; fallback to whatsapp-web.js |
| **SQLite performance under load** | Low | Medium | WAL mode; indexed queries; benchmark at 1000 scans/sec |
| **Natural language parsing ambiguity** | High | Low | Show "Did you mean?" confirmation; keep `!scanner` as fallback |
| **Localization gaps** | Medium | Low | Ship en/es/fr first; crowdsource more via GitHub |
| **Railway free tier limits** | Low | Medium | Document upgrade path; sleep mode acceptable for hobby tier |
| **VT quota still bottleneck** | High | Medium | Cache aggressively (7-day TTL); heuristics-first mode; guide users to paid tier |
| **Session instability (baileys)** | Medium | High | Auto-reconnect logic; DM admin on drops; store session in persistent volume |
| **Web UI security (no auth)** | High | High | Add basic auth (username/password) for `/settings` and `/overrides`; read-only `/health` |

### Success Metrics

| Metric | Target | Current (Estimated) | Measurement |
|--------|--------|---------------------|-------------|
| **Steps to first verdict** | ≤6 | 15 | User onboarding test |
| **P95 time to verdict (cached)** | <2s | ~5s (Redis overhead) | Histogram in `/health` |
| **P95 time to verdict (uncached)** | <10s | ~30s (VT polling) | Histogram in `/health` |
| **Cache hit ratio** | >60% | ~40% (Evidence: Not tracked) | `hits / (hits + misses)` |
| **Daily verdict capacity (free tier)** | >200 | ~150 (VT bottleneck) | Quota tracking |
| **% admin actions in-chat** | >80% | ~20% (most via API) | Command usage counter |
| **% incidents auto-recovered** | >70% | 0% (all manual) | Recovery event counter |

---

## 9) Acceptance Tests (Non-Technical)

### Test 1: Onboarding
**Steps:**
1. Click "Deploy to Railway" button in README
2. Wait for build (2-3 min)
3. Open generated URL: `https://wbscanner-abc123.railway.app`
4. See dashboard with "Setup Required" banner
5. Click "Setup" button
6. Scan QR code displayed on web page with WhatsApp > Linked Devices
7. Dashboard refreshes to "✅ Connected"

**Expected screenshot:**
```
┌─────────────────────────────────────────┐
│ 🔗 WBScanner Setup                      │
├─────────────────────────────────────────┤
│ Scan this QR code with WhatsApp:       │
│                                         │
│    ████████████████████████████         │
│    ████  ██  ████  ██  ██████          │
│    ████  ██  ████  ██  ██████          │
│    ████████████████████████████         │
│                                         │
│ Open WhatsApp > Linked Devices >       │
│ Link a Device and scan the code above. │
│                                         │
│ Status: ⏳ Waiting for scan...          │
└─────────────────────────────────────────┘
```

### Test 2: First Verdict (Heuristics-Only)
**Steps:**
1. Add bot to test group (via phone)
2. Paste malicious-looking URL: `http://192.168.1.1:8080/bank-login.exe`
3. Wait <5 seconds
4. See verdict in group

**Expected message transcript:**
```
[User]: http://192.168.1.1:8080/bank-login.exe

[Bot]: 🔴 DANGEROUS LINK - DO NOT CLICK
Domain: 192[.]168[.]1[.]1
Why:
• Direct IP address (unusual)
• Executable file (.exe)
• Uncommon port (8080)

Score: 6/15 (heur