# Admin Commands (in-chat)

Prefix: `!scanner`

- `!scanner mute 60` – mute group responses for 60 minutes.
- `!scanner unmute` – unmute group.
- `!scanner rescan <url>` – enqueue immediate rescan and surface the cache hash/job id.
- `!scanner status` – current status and recent stats.

`rescan` calls the control-plane API to invalidate caches, queues a high-priority scan, and returns the Redis hash plus BullMQ job id so responders can trace progress. Commands are admin-only.

