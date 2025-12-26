export type RbacRole = "control-plane" | "scan-orchestrator" | "wa-client";
export type SqlAction = "SELECT" | "INSERT" | "UPDATE" | "DELETE";

export const RBAC_PERMISSIONS: Record<
  RbacRole,
  Partial<Record<string, SqlAction[]>>
> = {
  "control-plane": {
    scans: ["SELECT"],
    overrides: ["SELECT", "INSERT", "UPDATE", "DELETE"],
    groups: ["UPDATE"],
  },
  "scan-orchestrator": {
    scans: ["INSERT", "UPDATE"],
    overrides: ["SELECT"],
  },
  "wa-client": {
    messages: ["INSERT", "UPDATE"],
    groups: ["INSERT", "UPDATE"],
    overrides: ["SELECT"],
  },
};

function normalizeIdentifier(input: string): string {
  return input.replace(/"/g, "").trim().toLowerCase();
}

export function parseSql(sql: string): { action: SqlAction; table: string } {
  const trimmed = sql.trim();
  const selectMatch = /^select\b[\s\S]*?\bfrom\s+([a-zA-Z0-9_\"]+)/i.exec(
    trimmed,
  );
  if (selectMatch) {
    return { action: "SELECT", table: normalizeIdentifier(selectMatch[1]) };
  }
  const insertMatch = /^insert\b[\s\S]*?\binto\s+([a-zA-Z0-9_\"]+)/i.exec(
    trimmed,
  );
  if (insertMatch) {
    return { action: "INSERT", table: normalizeIdentifier(insertMatch[1]) };
  }
  const updateMatch = /^update\s+([a-zA-Z0-9_\"]+)/i.exec(trimmed);
  if (updateMatch) {
    return { action: "UPDATE", table: normalizeIdentifier(updateMatch[1]) };
  }
  const deleteMatch = /^delete\b[\s\S]*?\bfrom\s+([a-zA-Z0-9_\"]+)/i.exec(
    trimmed,
  );
  if (deleteMatch) {
    return { action: "DELETE", table: normalizeIdentifier(deleteMatch[1]) };
  }
  throw new Error(`unable_to_parse_sql:${sql}`);
}

export function createRbacConnection(role: RbacRole) {
  return {
    async query(sql: string) {
      const { action, table } = parseSql(sql);
      const allowed = RBAC_PERMISSIONS[role][table]?.includes(action);
      if (!allowed) {
        const err = new Error("permission denied");
        (err as { code?: string }).code = "RBAC_DENIED";
        throw err;
      }
      return { rows: [] as unknown[] };
    },
  };
}
