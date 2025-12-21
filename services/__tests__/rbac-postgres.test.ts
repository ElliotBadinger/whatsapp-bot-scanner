import { Client } from "pg";

type ServiceEnvVar =
  | "DB_CONTROL_PLANE_URL"
  | "DB_SCAN_ORCHESTRATOR_URL"
  | "DB_WA_CLIENT_URL";

const requiredUrls: ServiceEnvVar[] = [
  "DB_CONTROL_PLANE_URL",
  "DB_SCAN_ORCHESTRATOR_URL",
  "DB_WA_CLIENT_URL",
];

function getConnectionString(name: ServiceEnvVar): string | null {
  const value = (process.env[name] ?? "").trim();
  if (!value) return null;
  if (!value.startsWith("postgres")) return null;
  return value;
}

async function withClient<T>(
  connectionString: string,
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function withRollback<T>(
  client: Client,
  fn: () => Promise<T>,
): Promise<T> {
  await client.query("BEGIN");
  try {
    return await fn();
  } finally {
    await client.query("ROLLBACK");
  }
}

const postgresRbacEnabled = (process.env.RBAC_POSTGRES_TESTS ?? "").trim() === "true";

const allUrlsAvailable = requiredUrls.every((name) => {
  return getConnectionString(name) !== null;
});

const describePostgres =
  postgresRbacEnabled && allUrlsAvailable ? describe : describe.skip;

describePostgres("Postgres RBAC", () => {
  it("enforces control-plane permissions", async () => {
    const connectionString = getConnectionString("DB_CONTROL_PLANE_URL");
    expect(connectionString).not.toBeNull();

    await withClient(connectionString as string, async (client) => {
      await withRollback(client, async () => {
        await expect(
          client.query("SELECT * FROM scans LIMIT 1"),
        ).resolves.toBeDefined();

        await expect(
          client.query("SELECT * FROM messages LIMIT 1"),
        ).rejects.toMatchObject({ code: "42501" });

        await expect(
          client.query(
            "INSERT INTO overrides (url_hash, status, scope) VALUES ($1, $2, $3)",
            ["postgres-test", "deny", "global"],
          ),
        ).resolves.toBeDefined();
      });
    });
  });

  it("enforces scan-orchestrator permissions", async () => {
    const connectionString = getConnectionString("DB_SCAN_ORCHESTRATOR_URL");
    expect(connectionString).not.toBeNull();

    await withClient(connectionString as string, async (client) => {
      await withRollback(client, async () => {
        await expect(
          client.query(
            "INSERT INTO scans (url_hash, normalized_url, verdict, score, reasons) VALUES ($1, $2, $3, $4, $5)",
            ["postgres-test", "https://example.com/", "benign", 0, "[]"],
          ),
        ).resolves.toBeDefined();

        await expect(
          client.query("SELECT * FROM messages LIMIT 1"),
        ).rejects.toMatchObject({ code: "42501" });

        await expect(
          client.query("SELECT * FROM overrides LIMIT 1"),
        ).resolves.toBeDefined();
      });
    });
  });

  it("enforces wa-client permissions", async () => {
    const connectionString = getConnectionString("DB_WA_CLIENT_URL");
    expect(connectionString).not.toBeNull();

    await withClient(connectionString as string, async (client) => {
      await withRollback(client, async () => {
        await expect(
          client.query("SELECT * FROM scans LIMIT 1"),
        ).rejects.toMatchObject({ code: "42501" });

        await expect(
          client.query(
            "INSERT INTO groups (chat_id, name) VALUES ($1, $2)",
            ["postgres-test-chat", "Test Group"],
          ),
        ).resolves.toBeDefined();

        await expect(
          client.query("SELECT * FROM overrides LIMIT 1"),
        ).resolves.toBeDefined();
      });
    });
  });
});
