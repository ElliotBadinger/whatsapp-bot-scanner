import * as fs from "fs";
import * as path from "path";
import { Pool } from "pg";
import type { Logger } from "pino";

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
    this.pool = new Pool({
      connectionString:
        process.env.DB_SCAN_ORCHESTRATOR_URL || process.env.DATABASE_URL,
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
    // Note: This simple transaction wrapper might not work for all cases
    // where `fn` expects to run queries within the transaction context
    // without passing a client. For full compatibility, we'd need to pass
    // a transaction-aware client to `fn`, but that changes the interface.
    // For now, we'll execute `fn` directly, but warn that it might not be atomic
    // if it uses `this.query` which uses the pool directly.
    // A proper implementation would require `fn` to accept a query runner.

    // However, since the existing code uses `dbClient.getDatabase().transaction(...)` for SQLite,
    // we need to adapt the calling code to be agnostic or handle it here.
    // The calling code in index.ts does:
    // const transaction = dbClient.getDatabase().transaction(() => { ... });
    // transaction();

    // This implies `getDatabase()` returns the raw driver instance.
    // For Postgres, we can't easily return a synchronous transaction function like better-sqlite3.

    // We will need to refactor the calling code to use `dbClient.transaction(async () => ...)`
    // instead of accessing `getDatabase()` directly for transactions.

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
    const connectionUrl =
      process.env.DB_SCAN_ORCHESTRATOR_URL || process.env.DATABASE_URL;
    if (connectionUrl && connectionUrl.startsWith("postgres")) {
      sharedConnection = new PostgresConnection({ logger });
    } else {
      sharedConnection = new SQLiteConnection({ logger });
    }
  }
  return sharedConnection;
}

export function createConnection(
  config: DatabaseConfig = {},
): IDatabaseConnection {
  const connectionUrl =
    process.env.DB_SCAN_ORCHESTRATOR_URL || process.env.DATABASE_URL;
  if (connectionUrl && connectionUrl.startsWith("postgres")) {
    return new PostgresConnection(config);
  }
  return new SQLiteConnection(config);
}
