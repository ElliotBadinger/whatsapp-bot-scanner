const path = require("path");
const Database = require("better-sqlite3");

async function main() {
  const dbPath = process.env.SQLITE_DB_PATH || "./storage/wbscanner.db";

  // Ensure directory exists
  const fs = require("fs");
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(dbPath);

  // Enable WAL mode for better concurrency
  db.pragma("journal_mode = WAL");

  // Insert seed data
  const stmt = db.prepare(`
    INSERT INTO groups (chat_id, name, settings, muted_until)
    VALUES (?, ?, ?, NULL)
    ON CONFLICT (chat_id) DO NOTHING
  `);

  stmt.run(
    "TEST_CHAT_ID",
    "Test Group",
    JSON.stringify({ notify_admins: true }),
  );

  db.close();
  console.log("Seed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
