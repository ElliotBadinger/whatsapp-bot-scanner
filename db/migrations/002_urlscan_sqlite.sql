ALTER TABLE scans ADD COLUMN urlscan_uuid TEXT;
ALTER TABLE scans ADD COLUMN urlscan_status TEXT;
ALTER TABLE scans ADD COLUMN urlscan_submitted_at TEXT;
ALTER TABLE scans ADD COLUMN urlscan_completed_at TEXT;
ALTER TABLE scans ADD COLUMN urlscan_result TEXT;
ALTER TABLE scans ADD COLUMN urlscan_result_url TEXT;