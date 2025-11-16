import Database from 'better-sqlite3';
import { logger } from '../log';
import path from 'path';
import fs from 'fs';

export interface DatabaseConfig {
  path: string;
  readonly?: boolean;
  verbose?: boolean;
}

export class SQLiteDatabase {
  private db: Database.Database;

  constructor(config: DatabaseConfig) {
    // Ensure directory exists
    const dir = path.dirname(config.path);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(config.path, {
      readonly: config.readonly || false,
      verbose: config.verbose ? logger.debug.bind(logger) : undefined,
    });

    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    // Optimize for performance
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = -64000'); // 64MB cache
    this.db.pragma('temp_store = MEMORY');
    this.db.pragma('mmap_size = 268435456'); // 256MB mmap

    logger.info({ path: config.path }, 'SQLite database initialized');
  }

  get instance(): Database.Database {
    return this.db;
  }

  query<T = any>(sql: string, params?: any[]): T[] {
    const stmt = this.db.prepare(sql);
    return params ? stmt.all(...params) as T[] : stmt.all() as T[];
  }

  get<T = any>(sql: string, params?: any[]): T | undefined {
    const stmt = this.db.prepare(sql);
    return params ? stmt.get(...params) as T | undefined : stmt.get() as T | undefined;
  }

  run(sql: string, params?: any[]): Database.RunResult {
    const stmt = this.db.prepare(sql);
    return params ? stmt.run(...params) : stmt.run();
  }

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  close(): void {
    this.db.close();
    logger.info('SQLite database closed');
  }

  /**
   * Execute a raw SQL statement (for migrations)
   */
  exec(sql: string): void {
    this.db.exec(sql);
  }
}

export function createDatabase(config: DatabaseConfig): SQLiteDatabase {
  return new SQLiteDatabase(config);
}