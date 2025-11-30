-- The columns added in this migration are already present in the initial SQLite schema.
-- The only new change is the creation of an index.

CREATE INDEX IF NOT EXISTS idx_scans_urlscan_artifacts ON scans(urlscan_screenshot_path);
