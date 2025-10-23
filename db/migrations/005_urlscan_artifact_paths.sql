ALTER TABLE scans ADD COLUMN IF NOT EXISTS urlscan_screenshot_path TEXT;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS urlscan_dom_path TEXT;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS urlscan_artifact_stored_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_scans_urlscan_screenshot_path
  ON scans(urlscan_screenshot_path)
  WHERE urlscan_screenshot_path IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scans_urlscan_dom_path
  ON scans(urlscan_dom_path)
  WHERE urlscan_dom_path IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scans_urlscan_artifact_stored_at
  ON scans(urlscan_artifact_stored_at);
