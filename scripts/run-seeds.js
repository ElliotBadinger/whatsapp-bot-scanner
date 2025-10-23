#!/usr/bin/env node
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

  await client.query(`INSERT INTO groups (chat_id, name, settings, muted_until)
    VALUES ('TEST_CHAT_ID', 'Test Group', '{"notify_admins": true}', NULL)
    ON CONFLICT (chat_id) DO NOTHING`);

  await client.end();
  console.log('Seed complete.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

