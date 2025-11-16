-- SQLite version of PostgreSQL migrations

CREATE TABLE IF NOT EXISTS scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url_hash TEXT NOT NULL UNIQUE,
  normalized_url TEXT NOT NULL,
  first_seen_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  last_seen_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  verdict TEXT NOT NULL,
  score INTEGER NOT NULL,
  reasons TEXT NOT NULL DEFAULT '[]',
  vt_stats TEXT,
  gsafebrowsing_hit INTEGER DEFAULT 0,
  domain_age_days INTEGER,
  redirect_chain_summary TEXT,
  cache_ttl INTEGER,
  source_kind TEXT,
  created_by TEXT,
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
CREATE INDEX IF NOT EXISTS idx_scans_last_seen ON scans(last_seen_at);

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
CREATE INDEX IF NOT EXISTS idx_messages_posted_at ON messages(posted_at);

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
CREATE INDEX IF NOT EXISTS idx_overrides_pattern ON overrides(pattern);

CREATE TABLE IF NOT EXISTS groups (
  chat_id TEXT PRIMARY KEY,
  name TEXT,
  settings TEXT NOT NULL DEFAULT '{}',
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
  metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);