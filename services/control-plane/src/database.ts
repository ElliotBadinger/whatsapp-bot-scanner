import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';
import type { Logger } from 'pino';

interface DatabaseConfig {
  dbPath?: string;
  logger?: Logger;
}

export class SQLiteConnection {
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
      const stmt = this.db.prepare(sql);

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

  async transaction<T>(fn: () => T): Promise<T> {
    const transaction = this.db.transaction(fn);
    return transaction();
  }

  close(): void {
    this.db.close();
    if (this.logger) {
      this.logger.info('SQLite connection closed');
    }
  }
}

// Singleton connection for shared use
let sharedConnection: SQLiteConnection | null = null;

export function getSharedConnection(logger?: Logger): SQLiteConnection {
  if (!sharedConnection) {
    sharedConnection = new SQLiteConnection({ logger });
  }
  return sharedConnection;
}

export function createConnection(config: DatabaseConfig = {}): SQLiteConnection {
  return new SQLiteConnection(config);
}
