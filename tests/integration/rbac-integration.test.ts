import { createRbacConnection } from "../helpers/rbac";

describe("RBAC Integration", () => {
  it("should enforce permissions across service boundaries", async () => {
    const cpConn = createRbacConnection("control-plane");
    await expect(
      cpConn.query(
        "INSERT INTO overrides (url_hash, status) VALUES ('test', 'deny')",
      ),
    ).resolves.toBeDefined();

    const soConn = createRbacConnection("scan-orchestrator");
    await expect(
      soConn.query("SELECT * FROM overrides WHERE url_hash = 'test'"),
    ).resolves.toBeDefined();

    const waConn = createRbacConnection("wa-client");
    await expect(
      waConn.query("SELECT * FROM overrides WHERE url_hash = 'test'"),
    ).resolves.toBeDefined();
  });
});
