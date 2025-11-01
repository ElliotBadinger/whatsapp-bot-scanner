# Setup Wizard UX Walkthrough

## Before Overhaul (Bash Script v1)

- **Entry friction:** Script opens with plain ASCII summary but limited contextual help; prompts expect `y/n` input without alternative explanations or default rationales.
- **Cognitive load:** Mixed responsibilities (git pulls, Docker resets, API key collection, health checks) proceed with little framing between steps, making it hard for non-technical operators to understand progress.
- **Prompt tone:** Several warnings lean technical (“docker compose logs wa-client”) without companion descriptions or links to docs; anxiety-inducing for first-time operators.
- **Lack of previews:** No menu summarising chosen options before destructive actions; users confirm each choice individually without seeing the holistic plan.
- **Accessibility gaps:** Spinner-based feedback offers no textual progress counts, color-only differentiation, and instructions to “Press Enter to continue” without strongly indicating why.
- **API key capture:** Inputs happen one-by-one with limited inline guidance (e.g., not clarifying that keys can be pasted later via `.env`), and validation errors stop the flow abruptly.
- **WhatsApp pairing:** RemoteAuth narrative lives in log-style text; no branching for a quick comparison chart between auto-pair vs QR pairing paths.
- **Non-interactive mode:** Warnings describe consequences but do not produce a clear checklist for operators to revisit later.

## After Overhaul (Node Wizard v2)

- **Welcoming intro:** Boxen-based splash explains duration, phases, and cancellation controls; tone rewritten for empathy.
- **Plan-first flow:** Multi-select plan builder exposes pull/clean/reset choices plus branch override with a concise summary before any action runs.
- **Guided API capture:** Each integration now shows step-by-step signup guidance, impact labels, and respectful “skip for now” messaging. Missing keys are echoed in a post-run checklist instead of halting progress.
- **Accessible feedback:** Listr2 task list and ora timers provide textual progress and elapsed time; palette honours `NO_COLOR`, and every spinner emits a descriptive message.
- **RemoteAuth clarity:** Dedicated RemoteAuth explainer compares auto-pair vs QR, sanitises legacy numbers, and defaults sensibly for non-interactive runs.
- **Postrun dashboard:** Observability links, pending keys, disabled integrations, and an FAQ land in one place so operators leave with clear next steps.
- **Automation-friendly overrides:** Hidden environment toggles (`SETUP_ENV_PATH`, `SETUP_SKIP_*`) keep CI smoke tests isolated from real operator assets.

## Open Questions / Research Prompts

1. Should we embed a short primer about WhatsApp RemoteAuth before asking for a phone number?
2. Would offering a guided `.env` editor (surface keys + toggles) reduce manual edits post-setup?
3. Is it worthwhile to surface Docker health tips (CPU/RAM) before builds for low-powered laptops?
