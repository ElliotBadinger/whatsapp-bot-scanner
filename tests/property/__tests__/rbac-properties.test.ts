import fc from "fast-check";
import {
  getConnectionForService,
  getPermissionsForService,
  resetRbacState,
} from "../../../packages/shared/src/database/rbac";

const tables = ["scans", "messages", "overrides", "groups"] as const;
const services = ["control-plane", "scan-orchestrator", "wa-client"] as const;

describe("RBAC Property Tests", () => {
  beforeEach(() => resetRbacState());

  it("should ALWAYS deny cross-service table access", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...services),
        fc.constantFrom(...tables),
        async (service, table) => {
          const conn = getConnectionForService(service);
          const permissions = getPermissionsForService(service);
          if (!permissions[table]?.includes("select")) {
            await expect(
              conn.query(`SELECT * FROM ${table} LIMIT 1`),
            ).rejects.toThrow(/permission denied/);
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});
