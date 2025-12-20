import * as fs from "fs";
import * as path from "path";
import { Pool } from "pg";
import type { Logger } from "pino";
import { config as sharedConfig } from "@wbscanner/shared";

type SqliteStatement = {
  all: (...params: unknown[]) => unknown[];
  run: (
    ...params: unknown[]
  ) => { changes?: number; lastInsertRowid?: unknown } | unknown;
};

type SqliteDriver = {
  prepare: (sql: string) => SqliteStatement;
  pragma: (pragma: string) => unknown;
  transaction: <T>(fn: () => T) => () => T;
  close: () => void;
};

function createSqliteDriver(dbPath: string): SqliteDriver {
  let bunSqlite: { Database: new (path: string) => any } | null = null;
  try {
    bunSqlite = require("bun:sqlite") as {
      Database: new (path: string) => any;
    };
  } catch {
    bunSqlite = null;
  }

  if (bunSqlite) {
    const db = new bunSqlite.Database(dbPath);
    return {
      prepare(sql: string) {
        const stmt = db.query(sql);
        return {
          all: (...params: unknown[]) => stmt.all(...params),
          run: (...params: unknown[]) => stmt.run(...params),
        };
      },
      pragma(pragma: string) {
        return db.exec(`PRAGMA ${pragma}`);
      },
      transaction<T>(fn: () => T) {
        return () => {
          db.exec("BEGIN");
          try {
            const result = fn();
            db.exec("COMMIT");
            return result;
          } catch (err) {
            db.exec("ROLLBACK");
            throw err;
          }
        };
      },
      close() {
        if (typeof db.close === "function") {
          db.close();
        }
      },
    };
  }

  const BetterSqlite3 = require("better-sqlite3") as new (
    path: string,
  ) => SqliteDriver;
  return new BetterSqlite3(dbPath);
}

interface DatabaseConfig {
  dbPath?: string;
  logger?: Logger;
  connectionString?: string;
}

export interface IDatabaseConnection {
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
  transaction<T>(fn: () => T | Promise<T>): Promise<T>;
  close(): void;
  getDatabase(): SqliteDriver | Pool;
}

export class SQLiteConnection implements IDatabaseConnection {
  private db: SqliteDriver;
  private logger: Logger | undefined;

  constructor(config: DatabaseConfig = {}) {
    const dbPath =
      config.dbPath || process.env.SQLITE_DB_PATH || "./storage/wbscanner.db";

    // Ensure directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = createSqliteDriver(dbPath);
    this.logger = config.logger;

    // Enable WAL mode for better concurrency
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");
    this.db.pragma("cache_size = 64000");
    this.db.pragma("foreign_keys = ON");

    if (this.logger) {
      this.logger.info({ dbPath }, "SQLite connection established");
    }
  }

  getDatabase(): SqliteDriver {
    return this.db;
  }

  async query(
    sql: string,
    params: unknown[] = [],
  ): Promise<{ rows: unknown[] }> {
    try {
      // Convert Postgres-style placeholders ($1, $2) to SQLite (?)
      const sqliteSql = sql.replace(/\$\d+/g, "?");
      const stmt = this.db.prepare(sqliteSql);

      // Handle SELECT queries
      if (sql.trim().toLowerCase().startsWith("select")) {
        const rows = stmt.all(...(params as unknown[]));
        return { rows };
      }

      // Handle INSERT, UPDATE, DELETE queries
      const result = stmt.run(...(params as unknown[]));
      const resultObj =
        typeof result === "object" && result !== null
          ? (result as Record<string, unknown>)
          : null;
      const changes =
        resultObj && typeof resultObj.changes === "number"
          ? resultObj.changes
          : 0;
      const lastInsertRowid = resultObj ? resultObj.lastInsertRowid : undefined;
      return {
        rows: changes > 0 ? [{ affectedRows: changes, lastInsertRowid }] : [],
      };
    } catch (error) {
      if (this.logger) {
        this.logger.error({ error, sql, params }, "Database query failed");
      }
      throw error;
    }
  }

  async transaction<T>(fn: () => T | Promise<T>): Promise<T> {
    const transaction = this.db.transaction(fn);
    return transaction() as T;
  }

  close(): void {
    this.db.close();
    if (this.logger) {
      this.logger.info("SQLite connection closed");
    }
  }
}

export class PostgresConnection implements IDatabaseConnection {
  private pool: Pool;
  private logger: Logger | undefined;

  constructor(config: DatabaseConfig = {}) {
    this.logger = config.logger;
    const connectionString =
      config.connectionString ||
      sharedConfig.database.controlPlane.connectionString ||
      process.env.DATABASE_URL;
    this.pool = new Pool({
      connectionString,
    });

    this.pool.on("error", (err: Error) => {
      if (this.logger) {
        this.logger.error({ err }, "Unexpected error on idle client");
      }
    });

    if (this.logger) {
      this.logger.info("Postgres connection pool established");
    }
  }

  getDatabase(): Pool {
    return this.pool;
  }

  async query(
    sql: string,
    params: unknown[] = [],
  ): Promise<{ rows: unknown[] }> {
    try {
      // Convert SQLite-style placeholders (?) to Postgres ($1, $2)
      let paramIndex = 1;
      const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);

      const result = await this.pool.query(pgSql, params);
      return { rows: result.rows };
    } catch (error) {
      if (this.logger) {
        this.logger.error({ error, sql, params }, "Database query failed");
      }
      throw error;
    }
  }

  async transaction<T>(fn: () => T | Promise<T>): Promise<T> {
    return await fn();
  }

  close(): void {
    this.pool.end();
    if (this.logger) {
      this.logger.info("Postgres connection pool closed");
    }
  }
}

// Singleton connection for shared use
let sharedConnection: IDatabaseConnection | null = null;

export function getSharedConnection(logger?: Logger): IDatabaseConnection {
  if (!sharedConnection) {
    const connectionString = sharedConfig.database.controlPlane.connectionString;
    if (connectionString && connectionString.startsWith("postgres")) {
      sharedConnection = new PostgresConnection({ logger, connectionString });
      return sharedConnection;
    }
    sharedConnection = new SQLiteConnection({ logger });
  }
  return sharedConnection;
}

export function createConnection(
  config: DatabaseConfig = {},
): IDatabaseConnection {
  const dbUrl =
    config.connectionString ||
    sharedConfig.database.controlPlane.connectionString ||
    process.env.DATABASE_URL;
  if (dbUrl && dbUrl.startsWith("postgres")) {
    return new PostgresConnection({ ...config, connectionString: dbUrl });
  }
  return new SQLiteConnection(config);
}
