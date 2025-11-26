#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

async function main() {
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

  const migrationsDir = path.join(__dirname, '..', 'db', 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  
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
  console.log('Migrations complete.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
