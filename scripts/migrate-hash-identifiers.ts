import { Client } from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashChatId, hashMessageId } from "@wbscanner/shared";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const adminUrl = process.env.DB_ADMIN_URL || process.env.DATABASE_URL;
const sqlitePath =
  process.env.SQLITE_DB_PATH ||
  path.join(__dirname, "..", "storage", "wbscanner.db");

async function migratePostgres() {
  if (!adminUrl) {
    throw new Error(
      "DB_ADMIN_URL or DATABASE_URL must be set for PostgreSQL migrations",
    );
  }
  const client = new Client({ connectionString: adminUrl });
  await client.connect();

  try {
    const { rows: messageRows } = await client.query(
      "SELECT id, chat_id, message_id FROM messages WHERE chat_id_hash IS NULL OR message_id_hash IS NULL",
    );
    for (const row of messageRows) {
      const chatId = row.chat_id as string;
      const messageId = row.message_id as string;
      await client.query(
        "UPDATE messages SET chat_id_hash = $1, message_id_hash = $2 WHERE id = $3",
        [hashChatId(chatId), hashMessageId(messageId), row.id],
      );
    }

    const { rows: groupRows } = await client.query(
      "SELECT chat_id FROM groups WHERE chat_id_hash IS NULL",
    );
    for (const row of groupRows) {
      const chatId = row.chat_id as string;
      await client.query(
        "UPDATE groups SET chat_id_hash = $1 WHERE chat_id = $2",
        [hashChatId(chatId), chatId],
      );
    }

    console.log(
      `Migrated ${messageRows.length} messages and ${groupRows.length} groups`,
    );
  } finally {
    await client.end();
  }
}

async function migrateSqlite() {
  const requireFunc = (0, eval)("require") as (id: string) => unknown;
  const moduleName = ["better", "sqlite3"].join("-");
  const BetterSqlite3 = requireFunc(moduleName) as unknown as new (
    path: string,
  ) => any;
  const db = new BetterSqlite3(sqlitePath);

  try {
    const messageRows = db
      .prepare(
        "SELECT id, chat_id, message_id FROM messages WHERE chat_id_hash IS NULL OR message_id_hash IS NULL",
      )
      .all();
    const updateMessage = db.prepare(
      "UPDATE messages SET chat_id_hash = ?, message_id_hash = ? WHERE id = ?",
    );
    for (const row of messageRows) {
      updateMessage.run(
        hashChatId(row.chat_id),
        hashMessageId(row.message_id),
        row.id,
      );
    }

    const groupRows = db
      .prepare("SELECT chat_id FROM groups WHERE chat_id_hash IS NULL")
      .all();
    const updateGroup = db.prepare(
      "UPDATE groups SET chat_id_hash = ? WHERE chat_id = ?",
    );
    for (const row of groupRows) {
      updateGroup.run(hashChatId(row.chat_id), row.chat_id);
    }

    console.log(
      `Migrated ${messageRows.length} messages and ${groupRows.length} groups`,
    );
  } finally {
    db.close();
  }
}

async function main() {
  if (adminUrl && adminUrl.startsWith("postgres")) {
    await migratePostgres();
    return;
  }
  await migrateSqlite();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
