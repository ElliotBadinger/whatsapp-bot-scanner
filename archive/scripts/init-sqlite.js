


/**
 * SQLite Database Initialization Script
 * 
 * This script initializes the SQLite database with proper configuration
 * including WAL mode, cache settings, and initial schema validation.
 */

import { getSharedConnection } from '../services/scan-orchestrator/src/database.js';

async function initSQLite() {
  console.log('Initializing SQLite database...');

  try {
    const db = getSharedConnection();

    // Enable WAL mode for better concurrency
    await db.query('PRAGMA journal_mode = WAL;');
    console.log('✓ WAL mode enabled');

    // Set cache size (64MB)
    await db.query('PRAGMA cache_size = 64000;');
    console.log('✓ Cache size configured');

    // Enable foreign keys
    await db.query('PRAGMA foreign_keys = ON;');
    console.log('✓ Foreign keys enabled');

    // Set synchronous mode for better performance
    await db.query('PRAGMA synchronous = NORMAL;');
    console.log('✓ Synchronous mode configured');

    // Set timeout for busy database
    await db.query('PRAGMA busy_timeout = 30000;');
    console.log('✓ Busy timeout configured');

    // Enable auto-vacuum
    await db.query('PRAGMA auto_vacuum = INCREMENTAL;');
    console.log('✓ Auto-vacuum enabled');

    // Check if migrations have been run
    const { rows } = await db.query('SELECT COUNT(*) as count FROM sqlite_master WHERE type = "table";');
    const tableCount = rows[0].count;
    console.log(`✓ Database initialized with ${tableCount} tables`);

    console.log('SQLite database initialization completed successfully!');

  } catch (error) {
    console.error('Failed to initialize SQLite database:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  initSQLite();
}
