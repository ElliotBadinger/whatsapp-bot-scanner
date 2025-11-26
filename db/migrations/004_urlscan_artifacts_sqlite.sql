CREATE TABLE IF NOT EXISTS urlscan_artifacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url_hash TEXT NOT NULL,
  artifact_type TEXT NOT NULL,
  content BLOB NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (url_hash, artifact_type)
);

CREATE INDEX IF NOT EXISTS urlscan_artifacts_type_idx ON urlscan_artifacts (artifact_type);