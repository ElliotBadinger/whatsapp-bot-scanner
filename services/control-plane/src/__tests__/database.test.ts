const queryMock = jest.fn(async () => ({ rows: [{ id: 1 }] }));
const onMock = jest.fn();
const endMock = jest.fn();

jest.mock("better-sqlite3", () => {
  return class MockDatabase {
    prepare() {
      return {
        all: () => [],
        run: () => ({ changes: 1, lastInsertRowid: 1 }),
      };
    }
    pragma() {
      return {};
    }
    transaction(fn: () => unknown) {
      return fn;
    }
    close() {
      return;
    }
  };
});

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
  getSharedConnection,
} from "../database";

describe("control-plane database", () => {
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

    const select = await conn.query(
      "SELECT * FROM overrides WHERE id = $1",
      [1],
    );
    expect(select.rows).toEqual([]);

    const update = await conn.query(
      "UPDATE overrides SET status = ? WHERE id = ?",
      ["ok", 2],
    );
    expect(update.rows.length).toBeGreaterThan(0);

    const db = conn.getDatabase() as unknown as { prepare: () => never };
    db.prepare = () => {
      throw new Error("boom");
    };
    await expect(conn.query("SELECT * FROM overrides")).rejects.toThrow("boom");
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
      "SELECT * FROM overrides WHERE id = ? AND status = ?",
      [1, "ok"],
    );
    expect(result.rows).toEqual([{ id: 1 }]);
    expect(queryMock).toHaveBeenCalledWith(
      "SELECT * FROM overrides WHERE id = $1 AND status = $2",
      [1, "ok"],
    );
    conn.close();
    expect(endMock).toHaveBeenCalled();
  });

  it("creates connections based on DB_CONTROL_PLANE_URL", () => {
    const prevControlPlaneUrl = process.env.DB_CONTROL_PLANE_URL;
    const prevDatabaseUrl = process.env.DATABASE_URL;
    delete process.env.DB_CONTROL_PLANE_URL;
    delete process.env.DATABASE_URL;

    jest.isolateModules(() => {
      const db = require("../database") as typeof import("../database");
      const sqlite = db.createConnection();
      expect(sqlite).toBeInstanceOf(db.SQLiteConnection);
    });

    process.env.DB_CONTROL_PLANE_URL = "postgres://example.com";
    jest.isolateModules(() => {
      const db = require("../database") as typeof import("../database");
      const pg = db.createConnection();
      expect(pg).toBeInstanceOf(db.PostgresConnection);
    });

    process.env.DB_CONTROL_PLANE_URL = prevControlPlaneUrl;
    process.env.DATABASE_URL = prevDatabaseUrl;
  });

  it("getSharedConnection selects driver based on env", () => {
    const prevControlPlaneUrl = process.env.DB_CONTROL_PLANE_URL;
    const prevDatabaseUrl = process.env.DATABASE_URL;
    delete process.env.DB_CONTROL_PLANE_URL;
    delete process.env.DATABASE_URL;

    jest.isolateModules(() => {
      const db = require("../database") as typeof import("../database");
      const sqlite = db.getSharedConnection();
      expect(sqlite).toBeInstanceOf(db.SQLiteConnection);
    });

    process.env.DB_CONTROL_PLANE_URL = "postgres://example.com";
    jest.isolateModules(() => {
      const db = require("../database") as typeof import("../database");
      const pg = db.getSharedConnection();
      expect(pg).toBeInstanceOf(db.PostgresConnection);
    });

    process.env.DB_CONTROL_PLANE_URL = prevControlPlaneUrl;
    process.env.DATABASE_URL = prevDatabaseUrl;
  });

  it("runs Postgres transaction wrapper", async () => {
    const conn = new PostgresConnection();
    const result = await conn.transaction(async () => "ok");
    expect(result).toBe("ok");
    conn.close();
  });
});
