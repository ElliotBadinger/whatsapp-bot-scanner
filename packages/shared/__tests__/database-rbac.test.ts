import { createRbacConnection } from "../../../tests/helpers/rbac";

describe("Database RBAC", () => {
  it("should prevent control-plane from reading messages table", async () => {
    const conn = createRbacConnection("control-plane");
    await expect(conn.query("SELECT * FROM messages LIMIT 1")).rejects.toThrow(
      /permission denied/i,
    );
  });

  it("should allow control-plane to write overrides", async () => {
    const conn = createRbacConnection("control-plane");
    await expect(
      conn.query(
        "INSERT INTO overrides (url_hash, status, scope) VALUES ('test', 'allow', 'global')",
      ),
    ).resolves.toBeDefined();
  });

  it("should prevent scan-orchestrator from accessing messages", async () => {
    const conn = createRbacConnection("scan-orchestrator");
    await expect(conn.query("SELECT * FROM messages LIMIT 1")).rejects.toThrow(
      /permission denied/i,
    );
  });

  it("should allow scan-orchestrator to write scans", async () => {
    const conn = createRbacConnection("scan-orchestrator");
    await expect(
      conn.query(
        "INSERT INTO scans (url_hash, verdict, score) VALUES ('test', 'benign', 5)",
      ),
    ).resolves.toBeDefined();
  });

  it("should prevent wa-client from reading scans table", async () => {
    const conn = createRbacConnection("wa-client");
    await expect(conn.query("SELECT * FROM scans LIMIT 1")).rejects.toThrow(
      /permission denied/i,
    );
  });
});
