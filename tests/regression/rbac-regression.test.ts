import { createRbacConnection } from "../helpers/rbac";

describe("RBAC Regression Suite", () => {
  it("should preserve existing scan workflow", async () => {
    const waConn = createRbacConnection("wa-client");
    await expect(
      waConn.query(
        "INSERT INTO messages (chat_id, message_id, url_hash, verdict) VALUES ('chat', 'msg1', 'hash', 'pending')",
      ),
    ).resolves.toBeDefined();

    const soConn = createRbacConnection("scan-orchestrator");
    await expect(
      soConn.query(
        "INSERT INTO scans (url_hash, verdict, score) VALUES ('hash', 'malicious', 15)",
      ),
    ).resolves.toBeDefined();

    const cpConn = createRbacConnection("control-plane");
    await expect(cpConn.query("SELECT * FROM scans")).resolves.toBeDefined();
  });

  it("should preserve admin override workflow", async () => {
    const cpConn = createRbacConnection("control-plane");
    await expect(
      cpConn.query(
        "INSERT INTO overrides (url_hash, status, scope) VALUES ('hash', 'deny', 'global')",
      ),
    ).resolves.toBeDefined();
  });
});
