import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';
import { Pool } from 'pg';
import type { Logger } from 'pino';

interface DatabaseConfig {
  dbPath?: string;
  logger?: Logger;
}

export interface IDatabaseConnection {
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
  transaction<T>(fn: () => T | Promise<T>): Promise<T>;
  close(): void;
  getDatabase(): Database.Database | Pool;
}

export class SQLiteConnection implements IDatabaseConnection {
  private db: Database.Database;
  private logger: Logger | undefined;

  constructor(config: DatabaseConfig = {}) {
    const dbPath = config.dbPath || process.env.SQLITE_DB_PATH || './storage/wbscanner.db';

    // Ensure directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.logger = config.logger;

    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 64000');
    this.db.pragma('foreign_keys = ON');

    if (this.logger) {
      this.logger.info({ dbPath }, 'SQLite connection established');
    }
  }

  getDatabase(): Database.Database {
    return this.db;
  }

  async query(sql: string, params: unknown[] = []): Promise<{ rows: unknown[] }> {
    try {
      // Convert Postgres-style placeholders ($1, $2) to SQLite (?)
      const sqliteSql = sql.replace(/\$\d+/g, '?');
      const stmt = this.db.prepare(sqliteSql);

      // Handle SELECT queries
      if (sql.trim().toLowerCase().startsWith('select')) {
        const rows = stmt.all(...(params as unknown[]));
        return { rows };
      }

      // Handle INSERT, UPDATE, DELETE queries
      const result = stmt.run(...(params as unknown[]));
      return {
        rows: result.changes > 0 ? [{ affectedRows: result.changes, lastInsertRowid: result.lastInsertRowid }] : []
      };
    } catch (error) {
      if (this.logger) {
        this.logger.error({ error, sql, params }, 'Database query failed');
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
      this.logger.info('SQLite connection closed');
    }
  }
}

export class PostgresConnection implements IDatabaseConnection {
  private pool: Pool;
  private logger: Logger | undefined;

  constructor(config: DatabaseConfig = {}) {
    this.logger = config.logger;
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    this.pool.on('error', (err: Error) => {
      if (this.logger) {
        this.logger.error({ err }, 'Unexpected error on idle client');
      }
    });

    if (this.logger) {
      this.logger.info('Postgres connection pool established');
    }
  }

  getDatabase(): Pool {
    return this.pool;
  }

  async query(sql: string, params: unknown[] = []): Promise<{ rows: unknown[] }> {
    try {
      // Convert SQLite-style placeholders (?) to Postgres ($1, $2)
      let paramIndex = 1;
      const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
      
      const result = await this.pool.query(pgSql, params);
      return { rows: result.rows };
    } catch (error) {
      if (this.logger) {
        this.logger.error({ error, sql, params }, 'Database query failed');
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
      this.logger.info('Postgres connection pool closed');
    }
  }
}

// Singleton connection for shared use
let sharedConnection: IDatabaseConnection | null = null;

export function getSharedConnection(logger?: Logger): IDatabaseConnection {
  if (!sharedConnection) {
    if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
      sharedConnection = new PostgresConnection({ logger });
    } else {
      sharedConnection = new SQLiteConnection({ logger });
    }
  }
  return sharedConnection;
}

export function createConnection(config: DatabaseConfig = {}): IDatabaseConnection {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
    return new PostgresConnection(config);
  }
  return new SQLiteConnection(config);
}
