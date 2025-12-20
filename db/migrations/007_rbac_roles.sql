-- Postgres-only RBAC roles and grants (skipped for SQLite)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'control_plane_role') THEN
    CREATE ROLE control_plane_role WITH LOGIN PASSWORD {{DB_CONTROL_PLANE_PASSWORD}};
  ELSE
    ALTER ROLE control_plane_role WITH LOGIN PASSWORD {{DB_CONTROL_PLANE_PASSWORD}};
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'scan_orchestrator_role') THEN
    CREATE ROLE scan_orchestrator_role WITH LOGIN PASSWORD {{DB_SCAN_ORCHESTRATOR_PASSWORD}};
  ELSE
    ALTER ROLE scan_orchestrator_role WITH LOGIN PASSWORD {{DB_SCAN_ORCHESTRATOR_PASSWORD}};
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wa_client_role') THEN
    CREATE ROLE wa_client_role WITH LOGIN PASSWORD {{DB_WA_CLIENT_PASSWORD}};
  ELSE
    ALTER ROLE wa_client_role WITH LOGIN PASSWORD {{DB_WA_CLIENT_PASSWORD}};
  END IF;
END $$;

-- Ensure schema access
GRANT USAGE ON SCHEMA public TO control_plane_role, scan_orchestrator_role, wa_client_role;

-- Reset table privileges
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM control_plane_role, scan_orchestrator_role, wa_client_role;

-- Control-plane: read scans, write/read overrides, update groups
GRANT SELECT ON scans TO control_plane_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON overrides TO control_plane_role;
GRANT UPDATE ON groups TO control_plane_role;

-- Scan orchestrator: write scans, read overrides
GRANT INSERT, UPDATE ON scans TO scan_orchestrator_role;
GRANT SELECT ON overrides TO scan_orchestrator_role;

-- WA client: write messages + groups, read overrides
GRANT INSERT, UPDATE ON messages TO wa_client_role;
GRANT INSERT, UPDATE ON groups TO wa_client_role;
GRANT SELECT ON overrides TO wa_client_role;

-- Sequence privileges for inserts
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO control_plane_role, scan_orchestrator_role, wa_client_role;
