import { createRbacConnection } from "../../tests/helpers/rbac";

describe("RBAC Mutation Coverage", () => {
  it("should detect removed permission checks", async () => {
    const conn = createRbacConnection("scan-orchestrator");
    await expect(
      conn.query("DELETE FROM overrides WHERE 1=1"),
    ).rejects.toThrow(/permission denied/i);
  });

  it("should detect weakened permission logic", async () => {
    const conn = createRbacConnection("scan-orchestrator");
    await expect(
      conn.query("DELETE FROM overrides WHERE 1=1"),
    ).rejects.toThrow(/permission denied/i);
  });
});
