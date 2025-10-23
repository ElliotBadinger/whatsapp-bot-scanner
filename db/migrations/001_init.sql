CREATE TABLE IF NOT EXISTS scans (
  id BIGSERIAL PRIMARY KEY,
  url_hash TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verdict TEXT NOT NULL,
  score INTEGER NOT NULL,
  reasons JSONB NOT NULL DEFAULT '[]',
  vt_stats JSONB,
  gsafebrowsing_hit BOOLEAN DEFAULT FALSE,
  domain_age_days INTEGER,
  redirect_chain_summary JSONB,
  cache_ttl INTEGER,
  source_kind TEXT,
  created_by TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS scans_url_hash_idx ON scans(url_hash);

CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  chat_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  sender_id_hash TEXT,
  url_hash TEXT NOT NULL,
  verdict TEXT,
  posted_at TIMESTAMPTZ,
  suppressed_reason TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS msg_unique_idx ON messages(chat_id, message_id, url_hash);

CREATE TABLE IF NOT EXISTS overrides (
  id BIGSERIAL PRIMARY KEY,
  url_hash TEXT,
  pattern TEXT,
  status TEXT NOT NULL CHECK (status IN ('allow','deny')),
  scope TEXT NOT NULL CHECK (scope IN ('global','group')),
  scope_id TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  reason TEXT
);

CREATE INDEX IF NOT EXISTS overrides_scope_idx ON overrides(scope, scope_id);

CREATE TABLE IF NOT EXISTS groups (
  chat_id TEXT PRIMARY KEY,
  name TEXT,
  settings JSONB NOT NULL DEFAULT '{}',
  muted_until TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS quotas (
  id BIGSERIAL PRIMARY KEY,
  api_name TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS quotas_api_window_idx ON quotas(api_name, window_start);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB
);

