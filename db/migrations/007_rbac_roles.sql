-- Implement minimal roles for service isolation.
-- Roles are created without passwords; set credentials out-of-band (e.g. via
-- secrets management + `ALTER ROLE ... PASSWORD ...`) if you use password auth.

-- Create service-specific roles (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'control_plane_role') THEN
    CREATE ROLE control_plane_role WITH LOGIN;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'scan_orchestrator_role') THEN
    CREATE ROLE scan_orchestrator_role WITH LOGIN;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wa_client_role') THEN
    CREATE ROLE wa_client_role WITH LOGIN;
  END IF;
END $$;

-- Grant minimal permissions aligned to each service
GRANT SELECT ON TABLE public.scans TO control_plane_role;
GRANT INSERT, UPDATE, DELETE ON TABLE public.overrides TO control_plane_role;
GRANT USAGE, SELECT ON SEQUENCE public.overrides_id_seq TO control_plane_role;
REVOKE ALL PRIVILEGES ON TABLE public.messages, public.groups FROM control_plane_role;

GRANT INSERT, UPDATE ON TABLE public.scans TO scan_orchestrator_role;
GRANT USAGE, SELECT ON SEQUENCE public.scans_id_seq TO scan_orchestrator_role;
GRANT SELECT ON TABLE public.overrides TO scan_orchestrator_role;
REVOKE ALL PRIVILEGES ON TABLE public.messages, public.groups FROM scan_orchestrator_role;

GRANT INSERT, UPDATE ON TABLE public.messages, public.groups TO wa_client_role;
GRANT USAGE, SELECT ON SEQUENCE public.messages_id_seq TO wa_client_role;
GRANT SELECT ON TABLE public.overrides TO wa_client_role;
REVOKE ALL PRIVILEGES ON TABLE public.scans FROM wa_client_role;
