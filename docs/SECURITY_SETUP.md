# Security Setup (MVP)

Keep secrets out of git. Copy `.env.mvp.example` to `.env` and set a real value for the only required secret:

- `IDENTIFIER_HASH_SECRET` — used to hash identifiers consistently.

That is all the MVP needs by default. External API keys and advanced services are archived under `archive/`.
