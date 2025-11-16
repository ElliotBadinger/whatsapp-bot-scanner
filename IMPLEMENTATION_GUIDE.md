# Implementation Guide: Resource Optimization Refactoring

This guide provides detailed, step-by-step instructions for implementing the resource optimization refactoring outlined in REFACTORING_PLAN.md.

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Git
- Understanding of TypeScript, SQLite, and WhatsApp protocol

## Phase 1: SQLite Migration

### Step 1.1: Install Dependencies

```bash
# In root package.json
npm install --save better-sqlite3
npm install --save-dev @types/better-sqlite3

# In services/scan-orchestrator/package.json
cd services/scan-orchestrator
npm install --save better-sqlite3
npm install --save-dev @types/better-sqlite3

# In services/control-plane/package.json
cd ../control-plane
npm install --save better-sqlite3
npm install --save-dev @types/better-sqlite3
```

### Step 1.2: Create SQLite Database Module

Create `packages/shared/src/database/sqlite.ts`:

```typescript
import Database from 'better-sqlite3';
import { logger } from '../log';
import path from 'path';
import fs from 'fs';

export interface DatabaseConfig {
  path: string;
  readonly?: boolean;
  verbose?: boolean;
}

export class SQLiteDatabase {
  private db: Database.Database;

  constructor(config: DatabaseConfig) {
    // Ensure directory exists
    const dir = path.dirname(config.path);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(config.path, {
      readonly: config.readonly || false,
      verbose: config.verbose ? logger.debug.bind(logger) : undefined,
    });

    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    // Optimize for performance
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = -64000'); // 64MB cache
    this.db.pragma('temp_store = MEMORY');
    this.db.pragma('mmap_size = 268435456'); // 256MB mmap
  }

  get instance(): Database.Database {
    return this.db;
  }

  query<T = any>(sql: string, params?: any[]): T[] {
    const stmt = this.db.prepare(sql);
    return params ? stmt.all(...params) as T[] : stmt.all() as T[];
  }

  get<T = any>(sql: string, params?: any[]): T | undefined {
    const stmt = this.db.prepare(sql);
    return params ? stmt.get(...params) as T | undefined : stmt.get() as T | undefined;
  }

  run(sql: string, params?: any[]): Database.RunResult {
    const stmt = this.db.prepare(sql);
    return params ? stmt.run(...params) : stmt.run();
  }

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  close(): void {
    this.db.close();
  }
}

export function createDatabase(config: DatabaseConfig): SQLiteDatabase {
  return new SQLiteDatabase(config);
}
```

### Step 1.3: Convert Migrations

Create `db/migrations-sqlite/001_init.sql`:

```sql
-- SQLite version of PostgreSQL migrations

CREATE TABLE IF NOT EXISTS scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url_hash TEXT NOT NULL UNIQUE,
  normalized_url TEXT NOT NULL,
  first_seen_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  last_seen_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  verdict TEXT NOT NULL,
  score INTEGER NOT NULL,
  reasons TEXT NOT NULL DEFAULT '[]', -- JSON array
  vt_stats TEXT, -- JSON object
  gsafebrowsing_hit INTEGER DEFAULT 0, -- BOOLEAN as INTEGER
  domain_age_days INTEGER,
  redirect_chain_summary TEXT, -- JSON array
  cache_ttl INTEGER,
  source_kind TEXT,
  created_by TEXT,
  -- Additional columns for enhanced features
  final_url TEXT,
  was_shortened INTEGER DEFAULT 0,
  final_url_mismatch INTEGER DEFAULT 0,
  homoglyph_detected INTEGER DEFAULT 0,
  homoglyph_risk_level TEXT,
  decided_at INTEGER,
  urlscan_uuid TEXT,
  urlscan_status TEXT,
  urlscan_submitted_at INTEGER,
  urlscan_completed_at INTEGER,
  urlscan_result_url TEXT,
  urlscan_result TEXT,
  urlscan_screenshot_path TEXT,
  urlscan_dom_path TEXT,
  urlscan_artifact_stored_at INTEGER,
  whois_source TEXT,
  whois_registrar TEXT,
  shortener_provider TEXT
);

CREATE INDEX IF NOT EXISTS idx_scans_url_hash ON scans(url_hash);
CREATE INDEX IF NOT EXISTS idx_scans_verdict ON scans(verdict);
CREATE INDEX IF NOT EXISTS idx_scans_first_seen ON scans(first_seen_at);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  sender_id_hash TEXT,
  url_hash TEXT NOT NULL,
  verdict TEXT,
  posted_at INTEGER,
  suppressed_reason TEXT,
  UNIQUE(chat_id, message_id, url_hash)
);

CREATE INDEX IF NOT EXISTS idx_messages_chat_message ON messages(chat_id, message_id);
CREATE INDEX IF NOT EXISTS idx_messages_url_hash ON messages(url_hash);

CREATE TABLE IF NOT EXISTS overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url_hash TEXT,
  pattern TEXT,
  status TEXT NOT NULL CHECK (status IN ('allow','deny')),
  scope TEXT NOT NULL CHECK (scope IN ('global','group')),
  scope_id TEXT,
  created_by TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  expires_at INTEGER,
  reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_overrides_scope ON overrides(scope, scope_id);
CREATE INDEX IF NOT EXISTS idx_overrides_url_hash ON overrides(url_hash);

CREATE TABLE IF NOT EXISTS groups (
  chat_id TEXT PRIMARY KEY,
  name TEXT,
  settings TEXT NOT NULL DEFAULT '{}', -- JSON object
  muted_until INTEGER
);

CREATE TABLE IF NOT EXISTS quotas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_name TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quotas_api_window ON quotas(api_name, window_start);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  metadata TEXT -- JSON object
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
```

### Step 1.4: Update Configuration

Update `packages/shared/src/config.ts`:

```typescript
// Replace PostgreSQL config with SQLite
export const config = {
  // ... existing config ...
  
  // Remove postgres section
  // postgres: {
  //   host: process.env.POSTGRES_HOST || 'postgres',
  //   ...
  // },
  
  // Add SQLite config
  sqlite: {
    path: process.env.SQLITE_DB_PATH || './data/wbscanner.db',
    readonly: process.env.SQLITE_READONLY === 'true',
    verbose: process.env.SQLITE_VERBOSE === 'true',
  },
  
  // ... rest of config ...
};
```

### Step 1.5: Update Scan Orchestrator

Update `services/scan-orchestrator/src/index.ts`:

```typescript
// Replace PostgreSQL client
import { SQLiteDatabase, createDatabase } from '@wbscanner/shared';

// Replace:
// const pg = new PgClient({ ... });
// await pg.connect();

// With:
const db = createDatabase({
  path: config.sqlite.path,
  verbose: config.sqlite.verbose,
});

// Update all queries to use SQLite syntax
// Example: INSERT ... ON CONFLICT
db.run(
  `INSERT INTO scans (url_hash, normalized_url, verdict, score, reasons, ...)
   VALUES (?, ?, ?, ?, ?, ...)
   ON CONFLICT(url_hash) DO UPDATE SET
     last_seen_at = ?,
     verdict = ?,
     score = ?,
     ...`,
  [hash, normalizedUrl, verdict, score, JSON.stringify(reasons), ...]
);
```

### Step 1.6: Update Control Plane

Similar updates to `services/control-plane/src/index.ts`.

## Phase 2: Redis Optimization

### Step 2.1: Audit Redis Usage

Current Redis usage:
1. BullMQ queues (KEEP - essential)
2. Verdict caching (EVALUATE - could use node-cache)
3. Analysis caching (EVALUATE - could use node-cache)
4. Session storage (KEEP - shared state)
5. Rate limiting (KEEP - shared state)

### Step 2.2: Implement Hybrid Caching

Create `packages/shared/src/cache/hybrid.ts`:

```typescript
import NodeCache from 'node-cache';
import type Redis from 'ioredis';

export class HybridCache {
  private localCache: NodeCache;
  private redisCache: Redis;

  constructor(redis: Redis, ttlSeconds: number = 3600) {
    this.redisCache = redis;
    this.localCache = new NodeCache({
      stdTTL: ttlSeconds,
      checkperiod: ttlSeconds * 0.2,
      useClones: false,
    });
  }

  async get<T>(key: string): Promise<T | null> {
    // Try local cache first
    const local = this.localCache.get<T>(key);
    if (local !== undefined) {
      return local;
    }

    // Fall back to Redis
    const redis = await this.redisCache.get(key);
    if (redis) {
      try {
        const parsed = JSON.parse(redis) as T;
        this.localCache.set(key, parsed);
        return parsed;
      } catch {
        return null;
      }
    }

    return null;
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    
    // Set in both caches
    this.localCache.set(key, value, ttl);
    
    if (ttl) {
      await this.redisCache.set(key, serialized, 'EX', ttl);
    } else {
      await this.redisCache.set(key, serialized);
    }
  }

  async del(key: string): Promise<void> {
    this.localCache.del(key);
    await this.redisCache.del(key);
  }
}
```

## Phase 3: Baileys Migration

### Step 3.1: Install Baileys

```bash
cd services/wa-client
npm uninstall whatsapp-web.js qrcode-terminal
npm install @whiskeysockets/baileys qrcode-terminal
npm install --save-dev @types/qrcode-terminal
```

### Step 3.2: Create Baileys Connection Module

Create `services/wa-client/src/baileys/connection.ts`:

```typescript
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
  WASocket,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { logger } from '@wbscanner/shared';
import QRCode from 'qrcode-terminal';

export interface BaileysConnectionConfig {
  authDir: string;
  printQR: boolean;
  phoneNumber?: string;
}

export async function createBaileysConnection(
  config: BaileysConnectionConfig
): Promise<WASocket> {
  const { state, saveCreds } = await useMultiFileAuthState(config.authDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    printQRInTerminal: config.printQR,
    browser: Browsers.ubuntu('Chrome'),
    getMessage: async (key) => {
      return { conversation: '' };
    },
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && config.printQR) {
      QRCode.generate(qr, { small: false });
      logger.info('QR code generated, scan with WhatsApp');
    }

    if (connection === 'close') {
      const shouldReconnect =
        (lastDisconnect?.error as Boom)?.output?.statusCode !==
        DisconnectReason.loggedOut;

      logger.info({ shouldReconnect }, 'Connection closed');

      if (shouldReconnect) {
        createBaileysConnection(config);
      }
    } else if (connection === 'open') {
      logger.info('Connection opened');
    }
  });

  return sock;
}
```

### Step 3.3: Rewrite Message Handlers

Create `services/wa-client/src/baileys/handlers.ts`:

```typescript
import { WASocket, proto, WAMessage } from '@whiskeysockets/baileys';
import { extractUrls, normalizeUrl, urlHash } from '@wbscanner/shared';

export function setupMessageHandlers(sock: WASocket, scanQueue: Queue) {
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    for (const msg of messages) {
      if (type !== 'notify' || !msg.message) continue;

      const text = extractMessageText(msg);
      if (!text) continue;

      const urls = extractUrls(text);
      if (urls.length === 0) continue;

      const chatId = msg.key.remoteJid;
      const messageId = msg.key.id;

      if (!chatId || !messageId) continue;

      for (const url of urls) {
        const normalized = normalizeUrl(url);
        if (!normalized) continue;

        const hash = urlHash(normalized);

        await scanQueue.add('scan', {
          chatId,
          messageId,
          url: normalized,
          timestamp: Date.now(),
        });
      }
    }
  });

  sock.ev.on('messages.update', async (updates) => {
    // Handle message edits
    for (const update of updates) {
      if (update.update.editedMessage) {
        // Process edited message
      }
    }
  });

  sock.ev.on('messages.delete', async (deletion) => {
    // Handle message deletions
  });
}

function extractMessageText(msg: WAMessage): string | null {
  const content = msg.message;
  if (!content) return null;

  if (content.conversation) return content.conversation;
  if (content.extendedTextMessage?.text) return content.extendedTextMessage.text;
  if (content.imageMessage?.caption) return content.imageMessage.caption;
  if (content.videoMessage?.caption) return content.videoMessage.caption;

  return null;
}
```

## Phase 4: Docker Compose Updates

Update `docker-compose.yml`:

```yaml
services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: ["redis-server", "--save", "60", "1", "--appendonly", "yes", "--maxmemory", "128mb", "--maxmemory-policy", "allkeys-lru"]
    volumes:
      - redisdata:/data
    networks: [internal]

  # Remove postgres service entirely

  # Remove migrate service

  # Remove seed service

  wa-client:
    build:
      context: .
      dockerfile: services/wa-client/Dockerfile
    env_file: [.env]
    depends_on:
      - redis
    networks: [internal]
    volumes:
      - wa_session:/app/services/wa-client/data
      - sqlite_data:/app/data  # Add SQLite volume
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL","wget -qO- http://127.0.0.1:3000/healthz || exit 1"]
      interval: 10s
      timeout: 3s
      retries: 10
    security_opt:
      - no-new-privileges:true

  scan-orchestrator:
    build:
      context: .
      dockerfile: services/scan-orchestrator/Dockerfile
    env_file: [.env]
    depends_on:
      - redis
    networks: [internal]
    volumes:
      - sqlite_data:/app/data  # Add SQLite volume
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL","wget -qO- http://127.0.0.1:3001/healthz || exit 1"]
      interval: 10s
      timeout: 3s
      retries: 10
    security_opt:
      - no-new-privileges:true

  control-plane:
    build:
      context: .
      dockerfile: services/control-plane/Dockerfile
    env_file: [.env]
    depends_on:
      - redis
    networks: [internal]
    volumes:
      - sqlite_data:/app/data  # Add SQLite volume
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL","wget --header=\"Authorization: Bearer ${CONTROL_PLANE_API_TOKEN}\" -qO- http://127.0.0.1:8080/healthz || exit 1"]
      interval: 10s
      timeout: 3s
      retries: 10
    security_opt:
      - no-new-privileges:true

  # Keep other services as-is

networks:
  internal:
    driver: bridge
  public:
    driver: bridge

volumes:
  sqlite_data:  # New SQLite volume
  wa_session:
  redisdata:
  prometheus_data:
  uptime_kuma_data:
```

## Phase 5: Environment Configuration

Update `.env.example`:

```bash
# Remove PostgreSQL variables
# POSTGRES_HOST=postgres
# POSTGRES_PORT=5432
# POSTGRES_DB=wbscanner
# POSTGRES_USER=wbscanner
# POSTGRES_PASSWORD=wbscanner

# Add SQLite configuration
SQLITE_DB_PATH=./data/wbscanner.db
SQLITE_READONLY=false
SQLITE_VERBOSE=false

# Redis - optimized
REDIS_URL=redis://redis:6379/0
REDIS_MAX_MEMORY=128mb

# ... rest of configuration ...
```

## Testing Strategy

### Unit Tests

```bash
# Test SQLite operations
npm run test -- packages/shared/src/database/__tests__/sqlite.test.ts

# Test Baileys handlers
npm run test -- services/wa-client/__tests__/baileys.test.ts
```

### Integration Tests

```bash
# Test full message flow
npm run test:e2e -- tests/e2e/message-flow.test.ts

# Test database persistence
npm run test:integration -- tests/integration/sqlite-persistence.test.ts
```

### Performance Tests

```bash
# Memory profiling
node --inspect services/scan-orchestrator/dist/index.js

# Load testing
npm run test:load
```

## Migration Guide

### For Existing Deployments

1. **Backup PostgreSQL data**:
```bash
docker-compose exec postgres pg_dump -U wbscanner wbscanner > backup.sql
```

2. **Export to JSON**:
```bash
node scripts/export-postgres-to-json.js > data-export.json
```

3. **Stop services**:
```bash
make down
```

4. **Pull new code**:
```bash
git pull origin refactor/resource-optimization
```

5. **Import to SQLite**:
```bash
node scripts/import-json-to-sqlite.js data-export.json
```

6. **Start services**:
```bash
make up
```

## Rollback Plan

If issues arise:

1. **Stop services**: `make down`
2. **Checkout main**: `git checkout main`
3. **Restore PostgreSQL**: `docker-compose exec postgres psql -U wbscanner wbscanner < backup.sql`
4. **Start services**: `make up`

## Success Criteria

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All e2e tests pass
- [ ] Memory usage < 350MB baseline
- [ ] Scan latency P50 ≤ 5s, P95 ≤ 15s
- [ ] 7-day soak test without crashes
- [ ] Zero data loss during migration

## Next Steps

After completing this refactoring:

1. Monitor production metrics for 2 weeks
2. Gather user feedback
3. Optimize based on real-world usage
4. Consider additional optimizations (e.g., worker threads, clustering)