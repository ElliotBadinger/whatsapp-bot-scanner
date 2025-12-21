import {
  getControlPlaneConnection,
  resetRbacState,
} from "../../../packages/shared/src/database/rbac";

describe("RBAC Performance Impact", () => {
  beforeEach(() => resetRbacState());

  it("should not degrade query performance with role checks", async () => {
    const controlPlaneConn = getControlPlaneConnection();
    const iterations = 200;
    const start = process.hrtime.bigint();

    for (let i = 0; i < iterations; i += 1) {
      await controlPlaneConn.query("SELECT * FROM scans");
    }

    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const avgMs = durationMs / iterations;
    expect(avgMs).toBeLessThan(20);
  });
});
