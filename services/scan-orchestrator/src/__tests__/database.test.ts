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
    queryMock.mockClear();
    onMock.mockClear();
    endMock.mockClear();
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

  it("creates connections based on DATABASE_URL", () => {
    const prev = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    const sqlite = createConnection();
    expect(sqlite).toBeInstanceOf(SQLiteConnection);

    process.env.DATABASE_URL = "postgres://example.com";
    const pg = createConnection();
    expect(pg).toBeInstanceOf(PostgresConnection);

    process.env.DATABASE_URL = prev;
  });

  it("getSharedConnection reuses the singleton per env", () => {
    const prev = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    jest.isolateModules(() => {
      const db = require("../database");
      const conn = db.getSharedConnection();
      expect(conn).toBeInstanceOf(db.SQLiteConnection);
    });

    process.env.DATABASE_URL = "postgres://example.com";
    jest.isolateModules(() => {
      const db = require("../database");
      const conn = db.getSharedConnection();
      expect(conn).toBeInstanceOf(db.PostgresConnection);
    });

    process.env.DATABASE_URL = prev;
  });

  it("runs Postgres transaction wrapper", async () => {
    const conn = new PostgresConnection();
    const result = await conn.transaction(async () => "ok");
    expect(result).toBe("ok");
    conn.close();
  });
});
