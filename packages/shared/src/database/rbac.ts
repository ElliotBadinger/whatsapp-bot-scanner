type Operation = "select" | "insert" | "update" | "delete";

export type RbacService = "control-plane" | "scan-orchestrator" | "wa-client";

type Policy = Record<string, Operation[]>;

const SERVICE_POLICIES: Record<RbacService, Policy> = {
  "control-plane": {
    scans: ["select"],
    overrides: ["select", "insert", "update", "delete"],
    messages: [],
    groups: [],
  },
  "scan-orchestrator": {
    scans: ["insert", "update"],
    overrides: ["select"],
    messages: [],
    groups: [],
  },
  "wa-client": {
    messages: ["insert", "update"],
    groups: ["insert", "update"],
    overrides: ["select"],
    scans: [],
  },
};

export function getPermissionsForService(service: RbacService): Policy {
  return SERVICE_POLICIES[service];
}

function extractTarget(sql: string): { operation: Operation | null; table: string | null } {
  const normalized = sql.trim().toLowerCase();
  if (normalized.startsWith("select")) {
    const match = normalized.match(/from\s+([a-z0-9_]+)/);
    return { operation: "select", table: match ? match[1] : null };
  }
  if (normalized.startsWith("insert")) {
    const match = normalized.match(/into\s+([a-z0-9_]+)/);
    return { operation: "insert", table: match ? match[1] : null };
  }
  if (normalized.startsWith("update")) {
    const match = normalized.match(/update\s+([a-z0-9_]+)/);
    return { operation: "update", table: match ? match[1] : null };
  }
  if (normalized.startsWith("delete")) {
    const match = normalized.match(/from\s+([a-z0-9_]+)/);
    return { operation: "delete", table: match ? match[1] : null };
  }
  return { operation: null, table: null };
}

function assertPermission(
  service: RbacService,
  sql: string,
): { operation: Operation | null; table: string | null } {
  const { operation, table } = extractTarget(sql);
  if (!operation || !table) {
    return { operation, table };
  }
  const policy = SERVICE_POLICIES[service];
  const allowed = policy[table];
  if (Array.isArray(allowed) && allowed.length > 0) {
    if (!allowed.includes(operation)) {
      throw new Error(`permission denied for ${table}`);
    }
  } else if (policy[table] !== undefined) {
    // Explicitly listed but empty
    throw new Error(`permission denied for ${table}`);
  }
  return { operation, table };
}

type Row = Record<string, unknown>;

const sharedState: Record<string, Row[]> = {
  scans: [],
  overrides: [],
  messages: [],
  groups: [],
};

export function resetRbacState(): void {
  Object.keys(sharedState).forEach((key) => {
    sharedState[key] = [];
  });
}

export class MemoryRbacConnection {
  constructor(private readonly service: RbacService) {}

  async query(sql: string, params: unknown[] = []): Promise<{ rows: Row[] }> {
    const { operation, table } = assertPermission(this.service, sql);

    if (!operation || !table) {
      return { rows: [] };
    }

    switch (operation) {
      case "select": {
        if (table === "overrides" && sql.toLowerCase().includes("where")) {
          const hashParam = params[0];
          return {
            rows: sharedState.overrides.filter((row) =>
              hashParam ? row.url_hash === hashParam : true,
            ),
          };
        }
        return { rows: sharedState[table] ?? [] };
      }
      case "insert": {
        const entry: Row = {};
        if (table === "overrides") {
          const [url_hash, status, scope] = params;
          entry.url_hash = url_hash;
          entry.status = status;
          entry.scope = scope ?? "global";
        } else if (table === "scans") {
          const [url_hash, verdict, score] = params;
          entry.url_hash = url_hash;
          entry.verdict = verdict;
          entry.score = score;
        } else if (table === "messages") {
          const [chat_id_hash, message_id_hash, url_hash] = params;
          entry.chat_id_hash = chat_id_hash;
          entry.message_id_hash = message_id_hash;
          entry.url_hash = url_hash;
        }
        sharedState[table] = [...(sharedState[table] ?? []), entry];
        return { rows: [entry] };
      }
      case "update": {
        return { rows: [{ affectedRows: 1 }] };
      }
      case "delete": {
        sharedState[table] = [];
        return { rows: [{ affectedRows: 1 }] };
      }
      default:
        return { rows: [] };
    }
  }
}

export function getControlPlaneConnection(): MemoryRbacConnection {
  return new MemoryRbacConnection("control-plane");
}

export function getScanOrchestratorConnection(): MemoryRbacConnection {
  return new MemoryRbacConnection("scan-orchestrator");
}

export function getWaClientConnection(): MemoryRbacConnection {
  return new MemoryRbacConnection("wa-client");
}

export function getConnectionForService(service: RbacService): MemoryRbacConnection {
  return new MemoryRbacConnection(service);
}
