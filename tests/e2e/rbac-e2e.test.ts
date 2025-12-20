import { createRbacConnection } from "../helpers/rbac";

describe("RBAC E2E", () => {
  it("should handle full scan workflow with isolated permissions", async () => {
    const waConn = createRbacConnection("wa-client");
    await expect(
      waConn.query(
        "INSERT INTO messages (chat_id, message_id, url_hash, verdict) VALUES ('chat', 'msg1', 'hash', 'pending')",
      ),
    ).resolves.toBeDefined();

    const soConn = createRbacConnection("scan-orchestrator");
    await expect(
      soConn.query(
        "INSERT INTO scans (url_hash, verdict, score) VALUES ('hash', 'benign', 5)",
      ),
    ).resolves.toBeDefined();

    const cpConn = createRbacConnection("control-plane");
    await expect(cpConn.query("SELECT * FROM scans"))
      .resolves.toBeDefined();
    await expect(cpConn.query("SELECT * FROM messages"))
      .rejects.toThrow(/permission denied/i);
  });
});
