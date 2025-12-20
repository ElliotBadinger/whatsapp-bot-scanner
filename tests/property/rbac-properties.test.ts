import fc from "fast-check";
import { createRbacConnection, RBAC_PERMISSIONS, type RbacRole } from "../helpers/rbac";

const tables = ["scans", "messages", "overrides", "groups"] as const;
const actions = ["SELECT", "INSERT", "UPDATE", "DELETE"] as const;

type Table = (typeof tables)[number];
type Action = (typeof actions)[number];

function sqlFor(action: Action, table: Table): string {
  switch (action) {
    case "SELECT":
      return `SELECT * FROM ${table} LIMIT 1`;
    case "INSERT":
      return `INSERT INTO ${table} (id) VALUES (1)`;
    case "UPDATE":
      return `UPDATE ${table} SET id = 1`;
    case "DELETE":
      return `DELETE FROM ${table}`;
  }
}

describe("RBAC Property Tests", () => {
  it("should ALWAYS deny cross-service table access", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<RbacRole>(
          "control-plane",
          "scan-orchestrator",
          "wa-client",
        ),
        fc.constantFrom(...tables),
        fc.constantFrom(...actions),
        async (service: RbacRole, table: Table, action: Action) => {
          const conn = createRbacConnection(service);
          const allowed = RBAC_PERMISSIONS[service][table]?.includes(action);
          const sql = sqlFor(action, table);

          if (!allowed) {
            await expect(conn.query(sql)).rejects.toThrow(/permission denied/i);
          } else {
            await expect(conn.query(sql)).resolves.toBeDefined();
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
