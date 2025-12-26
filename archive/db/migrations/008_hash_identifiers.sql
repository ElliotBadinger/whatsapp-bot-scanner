-- Add hashed identifier columns
ALTER TABLE messages ADD COLUMN IF NOT EXISTS chat_id_hash TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_id_hash TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS chat_id_hash TEXT;

-- Indexes on hashed columns
CREATE INDEX IF NOT EXISTS idx_messages_chat_id_hash ON messages(chat_id_hash);
CREATE INDEX IF NOT EXISTS idx_messages_message_id_hash ON messages(message_id_hash);
CREATE INDEX IF NOT EXISTS idx_groups_chat_id_hash ON groups(chat_id_hash);
CREATE UNIQUE INDEX IF NOT EXISTS msg_hash_unique_idx ON messages(chat_id_hash, message_id_hash, url_hash);

-- Eventually drop plaintext columns after migration
-- ALTER TABLE messages DROP COLUMN chat_id;
-- ALTER TABLE messages DROP COLUMN message_id;
-- ALTER TABLE groups DROP COLUMN chat_id;
