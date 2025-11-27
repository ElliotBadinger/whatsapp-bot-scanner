#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const Database = require('better-sqlite3');

async function main() {
  const isPostgres = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres');
  const migrationsDir = path.join(__dirname, '..', 'db', 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  if (isPostgres) {
    console.log('Running migrations for PostgreSQL...');
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
    });
    await client.connect();

    try {
      // Create schema_migrations table
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id TEXT PRIMARY KEY,
          applied_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      // Get applied migrations
      const { rows } = await client.query('SELECT id FROM schema_migrations');
      const appliedMigrations = new Set(rows.map(row => row.id));

      for (const f of files) {
        if (appliedMigrations.has(f)) {
          console.log(`Skipping already applied migration: ${f}`);
          continue;
        }

        const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
        console.log(`Applying migration: ${f}`);

        try {
          await client.query('BEGIN');
          // Split SQL by semicolon to handle multiple statements if needed, 
          // but pg driver can handle multiple statements in one query string usually.
          // However, for safety and better error reporting, we might want to execute as is.
          // Note: pg driver supports multiple statements in a single query string.
          await client.query(sql);
          await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [f]);
          await client.query('COMMIT');
          console.log(`Successfully applied migration: ${f}`);
        } catch (e) {
          await client.query('ROLLBACK');
          console.error(`Failed to apply migration ${f}:`, e.message);
          throw e;
        }
      }
    } finally {
      await client.end();
    }
  } else {
    console.log('Running migrations for SQLite...');
    // Create database connection
    const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, '..', 'storage', 'wbscanner.db');
    const dbDir = path.dirname(dbPath);
    
    // Ensure directory exists
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    const db = new Database(dbPath);
    
    // Enable WAL mode for better concurrency
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = 64000');

    // Create schema_migrations table
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Get applied migrations
    const appliedMigrations = new Set(
      db.prepare('SELECT id FROM schema_migrations').all().map(row => row.id)
    );

    for (const f of files) {
      if (appliedMigrations.has(f)) {
        console.log(`Skipping already applied migration: ${f}`);
        continue;
      }
      
      const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
      console.log(`Applying migration: ${f}`);
      
      const transaction = db.transaction(() => {
        // Execute migration SQL
        db.exec(sql);
        
        // Record migration as applied
        db.prepare('INSERT INTO schema_migrations (id) VALUES (?)').run(f);
      });
      
      try {
        transaction();
        console.log(`Successfully applied migration: ${f}`);
      } catch (e) {
        console.error(`Failed to apply migration ${f}:`, e.message);
        throw e;
      }
    }

    db.close();
  }
  console.log('Migrations complete.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
