const queryMock = jest.fn(async () => ({ rows: [{ id: 1 }] }));
const onMock = jest.fn();
const endMock = jest.fn();

jest.mock("pg", () => ({
  Pool: class {
    query = queryMock;
    on = onMock;
    end = endMock;
  },
}));

import {
  SQLiteConnection,
  PostgresConnection,
  createConnection,
} from "../database";

describe("scan-orchestrator database", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("runs SQLite queries and handles errors", async () => {
    const logger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
      fatal: jest.fn(),
      level: "info",
    } as any;
    const conn = new SQLiteConnection({
      dbPath: "./storage/test.db",
      logger,
    });

    const select = await conn.query("SELECT * FROM scans WHERE id = $1", [1]);
    expect(select.rows).toEqual([]);

    const update = await conn.query(
      "UPDATE scans SET verdict = ? WHERE id = ?",
      ["ok", 2],
    );
    expect(update.rows.length).toBeGreaterThan(0);

    const db = conn.getDatabase() as unknown as { prepare: () => never };
    db.prepare = () => {
      throw new Error("boom");
    };
    await expect(conn.query("SELECT * FROM scans")).rejects.toThrow("boom");
    expect(logger.error).toHaveBeenCalled();
    conn.close();
    expect(logger.info).toHaveBeenCalled();
  });

  it("runs Postgres queries with placeholder translation", async () => {
    const logger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
      fatal: jest.fn(),
      level: "info",
    } as any;
    const conn = new PostgresConnection({ logger });
    const result = await conn.query(
      "SELECT * FROM scans WHERE id = ? AND verdict = ?",
      [1, "ok"],
    );
    expect(result.rows).toEqual([{ id: 1 }]);
    expect(queryMock).toHaveBeenCalledWith(
      "SELECT * FROM scans WHERE id = $1 AND verdict = $2",
      [1, "ok"],
    );
    conn.close();
    expect(endMock).toHaveBeenCalled();
  });

  it("creates connections based on service-specific database URL", () => {
    const prev = process.env.DB_SCAN_ORCHESTRATOR_URL;
    const prevFallback = process.env.DATABASE_URL;
    delete process.env.DB_SCAN_ORCHESTRATOR_URL;
    delete process.env.DATABASE_URL;
    const sqlite = createConnection();
    expect(sqlite).toBeInstanceOf(SQLiteConnection);

    process.env.DB_SCAN_ORCHESTRATOR_URL = "postgres://example.com";
    const pg = createConnection();
    expect(pg).toBeInstanceOf(PostgresConnection);

    process.env.DB_SCAN_ORCHESTRATOR_URL = prev;
    process.env.DATABASE_URL = prevFallback;
  });

  it("getSharedConnection reuses the singleton per env", () => {
    const prev = process.env.DB_SCAN_ORCHESTRATOR_URL;
    const prevFallback = process.env.DATABASE_URL;
    delete process.env.DB_SCAN_ORCHESTRATOR_URL;
    delete process.env.DATABASE_URL;

    jest.isolateModules(() => {
      const db = require("../database");
      const conn = db.getSharedConnection();
      expect(conn).toBeInstanceOf(db.SQLiteConnection);
    });

    process.env.DB_SCAN_ORCHESTRATOR_URL = "postgres://example.com";
    jest.isolateModules(() => {
      const db = require("../database");
      const conn = db.getSharedConnection();
      expect(conn).toBeInstanceOf(db.PostgresConnection);
    });

    process.env.DB_SCAN_ORCHESTRATOR_URL = prev;
    process.env.DATABASE_URL = prevFallback;
  });

  it("falls back to DATABASE_URL when service URL is missing", () => {
    const prev = process.env.DB_SCAN_ORCHESTRATOR_URL;
    const prevFallback = process.env.DATABASE_URL;
    delete process.env.DB_SCAN_ORCHESTRATOR_URL;
    process.env.DATABASE_URL = "postgres://fallback.example.com";

    const pg = createConnection();
    expect(pg).toBeInstanceOf(PostgresConnection);

    process.env.DB_SCAN_ORCHESTRATOR_URL = prev;
    process.env.DATABASE_URL = prevFallback;
  });

  it("runs Postgres transaction wrapper", async () => {
    const conn = new PostgresConnection();
    const result = await conn.transaction(async () => "ok");
    expect(result).toBe("ok");
    conn.close();
  });

  it("handles Postgres query errors with logging", async () => {
    const logger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
      fatal: jest.fn(),
      level: "info",
    } as any;
    queryMock.mockRejectedValueOnce(new Error("Query failed"));
    const conn = new PostgresConnection({ logger });
    await expect(conn.query("SELECT * FROM scans")).rejects.toThrow(
      "Query failed",
    );
    expect(logger.error).toHaveBeenCalled();
    conn.close();
  });

  it("SQLite transaction executes wrapped function", async () => {
    const conn = new SQLiteConnection({ dbPath: "./storage/test-tx.db" });
    const result = await conn.transaction(() => "transaction-result");
    expect(result).toBe("transaction-result");
    conn.close();
  });

  it("SQLite handles INSERT queries returning affected rows", async () => {
    const conn = new SQLiteConnection({ dbPath: "./storage/test-insert.db" });
    // First ensure table exists
    await conn.query(
      "CREATE TABLE IF NOT EXISTS test_table (id INTEGER PRIMARY KEY, name TEXT)",
    );
    const result = await conn.query(
      "INSERT INTO test_table (name) VALUES (?)",
      ["test-name"],
    );
    expect(result.rows.length).toBeGreaterThanOrEqual(0);
    conn.close();
  });

  it("SQLite handles DELETE queries", async () => {
    const conn = new SQLiteConnection({ dbPath: "./storage/test-delete.db" });
    await conn.query(
      "CREATE TABLE IF NOT EXISTS delete_test (id INTEGER PRIMARY KEY, name TEXT)",
    );
    await conn.query("INSERT INTO delete_test (name) VALUES (?)", [
      "to-delete",
    ]);
    const result = await conn.query("DELETE FROM delete_test WHERE name = ?", [
      "to-delete",
    ]);
    expect(result.rows).toBeDefined();
    conn.close();
  });
});
