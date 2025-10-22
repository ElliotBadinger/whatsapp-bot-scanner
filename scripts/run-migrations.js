#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const client = new Client({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT) : 5432,
    database: process.env.POSTGRES_DB || 'wbscanner',
    user: process.env.POSTGRES_USER || 'wbscanner',
    password: process.env.POSTGRES_PASSWORD || 'wbscanner',
  });

  await client.connect();
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);

  const migrationsDir = path.join(__dirname, '..', 'db', 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  for (const f of files) {
    const id = f;
    const res = await client.query('SELECT 1 FROM schema_migrations WHERE id=$1', [id]);
    if (res.rowCount > 0) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
    console.log(`Applying migration: ${id}`);
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [id]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  }

  await client.end();
  console.log('Migrations complete.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

