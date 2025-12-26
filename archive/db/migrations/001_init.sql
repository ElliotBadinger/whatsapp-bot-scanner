CREATE TABLE IF NOT EXISTS scans (
  id SERIAL PRIMARY KEY,
  url_hash TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  first_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
  verdict TEXT NOT NULL,
  score INTEGER NOT NULL,
  reasons TEXT NOT NULL DEFAULT '[]',
  vt_stats TEXT,
  gsafebrowsing_hit INTEGER DEFAULT 0,
  domain_age_days INTEGER,
  redirect_chain_summary TEXT,
  cache_ttl INTEGER,
  source_kind TEXT,
  created_by TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS scans_url_hash_idx ON scans(url_hash);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  chat_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  sender_id_hash TEXT,
  url_hash TEXT NOT NULL,
  verdict TEXT,
  posted_at TIMESTAMP,
  suppressed_reason TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS msg_unique_idx ON messages(chat_id, message_id, url_hash);

CREATE TABLE IF NOT EXISTS overrides (
  id SERIAL PRIMARY KEY,
  url_hash TEXT,
  pattern TEXT,
  status TEXT NOT NULL CHECK (status IN ('allow','deny')),
  scope TEXT NOT NULL CHECK (scope IN ('global','group')),
  scope_id TEXT,
  created_by TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP,
  reason TEXT
);

CREATE INDEX IF NOT EXISTS overrides_scope_idx ON overrides(scope, scope_id);

CREATE TABLE IF NOT EXISTS groups (
  chat_id TEXT PRIMARY KEY,
  name TEXT,
  settings TEXT NOT NULL DEFAULT '{}',
  muted_until TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quotas (
  id SERIAL PRIMARY KEY,
  api_name TEXT NOT NULL,
  window_start TIMESTAMP NOT NULL,
  count INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS quotas_api_window_idx ON quotas(api_name, window_start);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  metadata TEXT
);