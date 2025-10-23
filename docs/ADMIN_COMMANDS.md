# Admin Commands (in-chat)

Prefix: `!scanner`

- `!scanner mute 60` – mute group responses for 60 minutes.
- `!scanner unmute` – unmute group.
- `!scanner rescan <url>` – enqueue immediate rescan.
- `!scanner status` – current status and recent stats.

`rescan` calls the control-plane API to invalidate caches and queue a high-priority scan for the provided URL. Commands are admin-only.

