ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS whois_source TEXT,
  ADD COLUMN IF NOT EXISTS whois_registrar TEXT,
  ADD COLUMN IF NOT EXISTS shortener_provider TEXT;
