CREATE INDEX IF NOT EXISTS scans_last_seen_at_id_idx
  ON scans(last_seen_at, id);
