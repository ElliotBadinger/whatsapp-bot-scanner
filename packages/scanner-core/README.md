# @wbscanner/scanner-core

Lightweight, deterministic scanning primitives shared by WhatsApp bot runtimes.
By default, all scans rely only on local heuristics from `@wbscanner/shared`
(normalization, SSRF-safe expansion, scoring) and avoid external enrichers.

## API

- `extractUrls(text: string): string[]` — normalize common link patterns from free text.
- `scanUrl(url: string, options?: ScanOptions): Promise<ScanResult>` — score a single URL
  using heuristic signals; optional redirect following is SSRF-protected.
- `scanTextMessage({ text }: { text: string }, options?: ScanOptions): Promise<ScanResult[]>`
  — convenience helper that extracts, de-duplicates, and scans links in a message body.

Enable external enrichers explicitly with `options.enableExternalEnrichers = true`.
External enrichment is best-effort and depends on the shared provider config and
API keys (e.g. `VT_API_KEY`, `GSB_API_KEY`).
Scanner-core wires these checks through the same `@wbscanner/shared` primitives
used by `@wbscanner/scan-orchestrator`.
When external providers are unavailable or disabled, scans fall back to
heuristics-only and set `signals.heuristicsOnly = true`.
