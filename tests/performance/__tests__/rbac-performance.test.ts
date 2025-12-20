import {
  getControlPlaneConnection,
  resetRbacState,
} from "../../../packages/shared/src/database/rbac";

describe("RBAC Performance Impact", () => {
  beforeEach(() => resetRbacState());

  it("should not degrade query performance with role checks", async () => {
    const controlPlaneConn = getControlPlaneConnection();
    const iterations = 200;
    const start = Date.now();

    for (let i = 0; i < iterations; i += 1) {
      await controlPlaneConn.query("SELECT * FROM scans");
    }

    const duration = Date.now() - start;
    const avgMs = duration / iterations;
    expect(avgMs).toBeLessThan(5);
  });
});
