import fs from 'fs';
import path from 'path';
import { SQLiteDatabase } from './sqlite';
import { logger } from '../log';

export class MigrationRunner {
  private db: SQLiteDatabase;

  constructor(db: SQLiteDatabase) {
    this.db = db;
  }

  public runMigrations(migrationsDir: string) {
    this.ensureMigrationsTable();

    const appliedMigrations = this.getAppliedMigrations();
    const allMigrations = this.getAllMigrations(migrationsDir);

    const pendingMigrations = allMigrations.filter(
      (m) => !appliedMigrations.has(m)
    );

    if (pendingMigrations.length === 0) {
      logger.info('No pending migrations to apply.');
      return;
    }

    logger.info({ count: pendingMigrations.length }, 'Applying pending migrations...');

    for (const migration of pendingMigrations) {
      this.applyMigration(migrationsDir, migration);
    }

    logger.info('All migrations applied successfully.');
  }

  private ensureMigrationsTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY NOT NULL
      );
    `);
  }

  private getAppliedMigrations(): Set<string> {
    const rows = this.db.query<{ version: string }>(
      'SELECT version FROM schema_migrations'
    );
    return new Set(rows.map((r) => r.version));
  }

  private getAllMigrations(migrationsDir: string): string[] {
    const files = fs.readdirSync(migrationsDir);
    return files
      .filter((file) => file.endsWith('.sql'))
      .sort();
  }

  private applyMigration(migrationsDir: string, migration: string) {
    logger.info({ migration }, 'Applying migration...');
    const migrationPath = path.join(migrationsDir, migration);
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    try {
        this.db.transaction(() => {
            this.db.exec(sql);
            this.db.run('INSERT INTO schema_migrations (version) VALUES (?)', [
              migration,
            ]);
        });
        logger.info({ migration }, 'Migration applied.');
    } catch (err) {
        logger.error({ err, migration }, 'Failed to apply migration');
        throw err;
    }
  }
}
