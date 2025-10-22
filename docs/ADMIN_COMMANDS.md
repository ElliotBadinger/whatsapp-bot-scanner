# Admin Commands (in-chat)

Prefix: `!scanner`

- `!scanner mute 60` – mute group responses for 60 minutes.
- `!scanner unmute` – unmute group.
- `!scanner allow <url>` – allow URL (hash) in this group.
- `!scanner deny <url>` – deny URL (hash) in this group.
- `!scanner rescan <url>` – enqueue immediate rescan.
- `!scanner status` – current status and recent stats.

Note: Commands are admin-only and audit-logged in DB via control-plane in future iterations. Current build focuses on API-based admin control.

