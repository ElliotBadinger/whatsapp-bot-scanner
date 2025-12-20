import {
  getControlPlaneConnection,
  getScanOrchestratorConnection,
  getWaClientConnection,
  resetRbacState,
} from "../../packages/shared/src/database/rbac";

describe("RBAC Integration", () => {
  beforeEach(() => resetRbacState());

  it("should enforce permissions across service boundaries", async () => {
    const cpConn = getControlPlaneConnection();
    await cpConn.query(
      "INSERT INTO overrides (url_hash, status) VALUES (?, ?)",
      ["test", "deny"],
    );

    const soConn = getScanOrchestratorConnection();
    const result = await soConn.query(
      "SELECT * FROM overrides WHERE url_hash = ?",
      ["test"],
    );
    expect(result.rows).toHaveLength(1);

    const waConn = getWaClientConnection();
    const waResult = await waConn.query(
      "SELECT * FROM overrides WHERE url_hash = ?",
      ["test"],
    );
    expect(waResult.rows).toHaveLength(1);
  });
});
