ALTER TABLE scans ADD COLUMN IF NOT EXISTS urlscan_screenshot_path TEXT;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS urlscan_dom_path TEXT;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS urlscan_artifact_stored_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_scans_urlscan_artifacts ON scans(urlscan_screenshot_path) WHERE urlscan_screenshot_path IS NOT NULL;