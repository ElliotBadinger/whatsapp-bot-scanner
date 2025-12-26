import { createRbacConnection } from "../helpers/rbac";

describe("RBAC Performance Impact", () => {
  it("should not degrade query performance with role checks", async () => {
    const iterations = 2000;
    const conn = createRbacConnection("control-plane");
    const start = Date.now();

    for (let i = 0; i < iterations; i += 1) {
      await conn.query("SELECT * FROM scans");
    }

    const duration = Date.now() - start;
    const avgMs = duration / iterations;

    expect(avgMs).toBeLessThan(1);
  });
});
