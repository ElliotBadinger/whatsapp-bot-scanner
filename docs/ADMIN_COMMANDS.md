# Admin Commands (in-chat)

Prefix: `!scanner`

- `!scanner mute` – silence automated replies to the group for 60 minutes. Replies acknowledge success (`'Scanner muted for 60 minutes.'`) or failure.
- `!scanner unmute` – immediately lift the mute window so verdicts resume.
- `!scanner status` – fetch aggregate scan counts from the control-plane and post `scans=<count>, malicious=<count>` to the chat.
- `!scanner rescan <url>` – trigger an immediate rescan by POSTing to `/rescan`; clears Redis caches and enqueues a high-priority job for the supplied URL.

Commands are group-admin only. Unknown variations fall back to `Commands: !scanner mute|unmute|status|rescan <url>` so operators can discover the supported verbs.

