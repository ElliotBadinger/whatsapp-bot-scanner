CREATE TABLE IF NOT EXISTS urlscan_artifacts (
  id SERIAL PRIMARY KEY,
  url_hash TEXT NOT NULL,
  artifact_type TEXT NOT NULL,
  content BYTEA NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (url_hash, artifact_type)
);

CREATE INDEX IF NOT EXISTS urlscan_artifacts_type_idx ON urlscan_artifacts (artifact_type);