CREATE INDEX IF NOT EXISTS idx_scans_urlscan_dom_path
  ON scans(urlscan_dom_path);

CREATE INDEX IF NOT EXISTS idx_scans_urlscan_artifact_stored_at
  ON scans(urlscan_artifact_stored_at);
