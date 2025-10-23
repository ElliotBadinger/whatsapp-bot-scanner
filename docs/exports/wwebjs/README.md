# WhatsApp Web JS Docs Export

This folder contains a markdown snapshot of https://docs.wwebjs.dev captured on 2025-10-23 via `node scripts/export-wwebjs-docs.mjs`.

## Contents

- `*.md` – per-page markdown conversions with YAML frontmatter denoting the origin URL and capture timestamp.
- `docs-index.json` – manifest mapping each source URL to its local markdown file.

## Regenerating

Run the exporter from the repository root:

```bash
node scripts/export-wwebjs-docs.mjs
```

The script first attempts to use `sitemap.xml`; if unavailable, it performs a polite breadth-first crawl limited to the `docs.wwebjs.dev` domain and converts the `<main>` content of each page with Turndown + Cheerio. Output is rewritten in-place.
