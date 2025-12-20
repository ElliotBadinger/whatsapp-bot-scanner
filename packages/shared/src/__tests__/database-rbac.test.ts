import {
  getConnectionForService,
  getControlPlaneConnection,
  getPermissionsForService,
  getScanOrchestratorConnection,
  getWaClientConnection,
  resetRbacState,
} from "../database/rbac";

describe("Database RBAC", () => {
  beforeEach(() => resetRbacState());

  it("should prevent control-plane from reading messages table", async () => {
    const conn = getControlPlaneConnection();
    await expect(conn.query("SELECT * FROM messages LIMIT 1")).rejects.toThrow(
      /permission denied/,
    );
  });

  it("should allow control-plane to write overrides", async () => {
    const conn = getControlPlaneConnection();
    await expect(
      conn.query(
        "INSERT INTO overrides (url_hash, status, scope) VALUES (?, ?, ?)",
        ["test_hash", "allow", "global"],
      ),
    ).resolves.toBeDefined();
  });

  it("should prevent scan-orchestrator from accessing messages", async () => {
    const conn = getScanOrchestratorConnection();
    await expect(conn.query("SELECT * FROM messages LIMIT 1")).rejects.toThrow(
      /permission denied/,
    );
  });

  it("should allow scan-orchestrator to write scans", async () => {
    const conn = getScanOrchestratorConnection();
    await expect(
      conn.query(
        "INSERT INTO scans (url_hash, verdict, score) VALUES (?, ?, ?)",
        ["test_hash", "benign", 5],
      ),
    ).resolves.toBeDefined();
  });

  it("should prevent wa-client from reading scans table", async () => {
    const conn = getWaClientConnection();
    await expect(conn.query("SELECT * FROM scans LIMIT 1")).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe("RBAC Property Tests", () => {
  beforeEach(() => resetRbacState());

  const tables = ["scans", "messages", "overrides", "groups"] as const;
  const services = [
    "control-plane",
    "scan-orchestrator",
    "wa-client",
  ] as const;

  it("should always deny cross-service table access", async () => {
    for (const service of services) {
      const permissions = getPermissionsForService(service);
      for (const table of tables) {
        const conn = getConnectionForService(service);
        if (!permissions[table]?.includes("select")) {
          await expect(
            conn.query(`SELECT * FROM ${table} LIMIT 1`),
          ).rejects.toThrow(/permission denied/);
        }
      }
    }
  });
});
