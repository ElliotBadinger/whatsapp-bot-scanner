import {
  getControlPlaneConnection,
  getScanOrchestratorConnection,
  getWaClientConnection,
  resetRbacState,
} from "../../../packages/shared/src/database/rbac";

describe("RBAC E2E", () => {
  beforeEach(() => resetRbacState());

  it("should handle full scan workflow with isolated permissions", async () => {
    const waConn = getWaClientConnection();
    await waConn.query(
      "INSERT INTO messages (chat_id_hash, message_id_hash, url_hash, verdict) VALUES (?, ?, ?, ?)",
      ["chat-hash", "msg1", "https://evil.com", "pending"],
    );

    const soConn = getScanOrchestratorConnection();
    await expect(
      soConn.query("SELECT * FROM messages LIMIT 1"),
    ).rejects.toThrow(/permission denied/);

    await soConn.query(
      "INSERT INTO scans (url_hash, verdict, score) VALUES (?, ?, ?)",
      ["https://evil.com", "benign", 1],
    );

    const cpConn = getControlPlaneConnection();
    await expect(
      cpConn.query("SELECT * FROM messages LIMIT 1"),
    ).rejects.toThrow(/permission denied/);

    const scanResult = await cpConn.query("SELECT * FROM scans");
    expect(scanResult.rows.length).toBeGreaterThan(0);
  });
});
