-- Implement minimal roles for service isolation
-- Replace placeholder passwords with securely generated values prior to deployment

-- Create service-specific roles
CREATE ROLE control_plane_role WITH LOGIN PASSWORD '<replace-with-strong-secret>';
CREATE ROLE scan_orchestrator_role WITH LOGIN PASSWORD '<replace-with-strong-secret>';
CREATE ROLE wa_client_role WITH LOGIN PASSWORD '<replace-with-strong-secret>';

-- Grant minimal permissions aligned to each service
GRANT SELECT ON scans TO control_plane_role;
GRANT INSERT, UPDATE, DELETE ON overrides TO control_plane_role;
REVOKE ALL ON messages, groups FROM control_plane_role;

GRANT INSERT, UPDATE ON scans TO scan_orchestrator_role;
GRANT SELECT ON overrides TO scan_orchestrator_role;
REVOKE ALL ON messages, groups FROM scan_orchestrator_role;

GRANT INSERT, UPDATE ON messages, groups TO wa_client_role;
GRANT SELECT ON overrides TO wa_client_role;
REVOKE ALL ON scans FROM wa_client_role;
