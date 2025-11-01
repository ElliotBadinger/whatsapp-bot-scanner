# Ticket: Guided Setup Experience – Phase 3 Expansion

## Summary
Design and implement a significantly richer onboarding journey for `./setup.sh`, building on the current guided wizard to support both first-time non-technical operators and power users. The new experience should provide clarity, confidence, and customization through granular guidance, dynamic verbosity controls, contextual education, and built-in recovery tooling.

## Problem Statement
- Operators with varying familiarity levels need either succinct guardrails or deep operational insight; the current wizard offers a single narrative.
- Optional integrations, platform prerequisites, and remediation steps can overwhelm users when surfaced all at once.
- Support and product ops teams want consistent transcripts, shareable diagnostics, and replayable flows to speed troubleshooting.

## Objectives
1. **Adaptive UX Layers**
   - Introduce a “Guided” (default) mode with conversational explanations and visuals, plus an “Expert” mode with condensed status lines.
   - Allow toggling verbosity mid-run (e.g., press `v` to switch) and persist preference to a cache file.
   - Surface progressive disclosure for advanced options (e.g., custom Docker profiles, remote environments) only when relevant.
2. **Contextual Education**
   - Embed expandable “Why this matters” tooltips for risky steps (resets, API keys, RemoteAuth decisions).
   - Provide inline links or QR codes to short videos/docs for first-time operators.
   - Offer a glossary panel accessible via hotkey for CLI terminology.
3. **Recovery & Diagnostics**
   - Add automatic transcript export (`logs/setup-YYYYMMDD-HHmm.md`) with anonymized secrets.
   - Offer quick actions for common blockers (re-run preflight only, resume from Docker, purge caches).
   - Capture structured JSON outcome files for support ingestion.
4. **Inclusive Interaction**
   - Ensure all new visual treatments respect `NO_COLOR`, high-contrast requirements, and screen readers (ARIA hints for Ink components).
   - Provide audible cues and text captions for long-running phases.
   - Support keyboard-only navigation with consistent shortcuts.
5. **Extensibility**
   - Refactor to modular components (e.g., “Setup Phases” registry) to add future integrations without overloading the main file.
   - Create an internal plugin API for optional steps (e.g., SaaS scanners, telemetry consent).

## Deliverables
- Updated wizard (or new Node CLI layer) with adaptive modes, verbosity toggles, and extensible phase architecture.
- Transcript and JSON output artifacts stored under `logs/`.
- Enhanced documentation:
  - “Onboarding Modes & Controls” section in `docs/getting-started.md`.
  - Support playbook for transcript review in `docs/RUNBOOKS.md`.
- Automated tests covering:
  - Mode switching and persistence.
  - Transcript/JSON artifact creation.
  - Plugin registration and optional flow skips.
- Demo recording or GIF highlighting Guided vs Expert toggling.

## Acceptance Criteria
- [ ] Guided mode remains default and completes a full happy path without additional flags.
- [ ] Expert mode keeps runtime messaging under 10 lines per major phase while preserving error details.
- [ ] Users can toggle verbosity during runtime without restarting; mode change is acknowledged visually and in transcript metadata.
- [ ] Transcript and JSON artifacts redact secrets and record all decisions, flags, durations, and detected issues.
- [ ] Resume commands are available for at least three checkpoints: preflight, environment prep, container launch.
- [ ] Accessibility review completed (keyboard navigation, color contrast, NO_COLOR behavior, screen-reader scan).
- [ ] Documentation updated and reviewed by Support Ops.
- [ ] Usability pilot with at least one non-technical stakeholder; feedback logged and blockers resolved.

## Milestones
1. **UX & Architecture Design (1 week)**
   - Prototype mode-switch flows with Ink/Ink-Gradient or similar React CLI tooling.
   - Define plugin interface and artifact schemas (transcript markdown + JSON).
2. **Implementation (2–3 weeks)**
   - Build modular phase registry, mode toggles, and artifact writer.
   - Integrate recovery/resume checkpoints and hotkeys.
   - Harden accessibility and theming.
3. **Validation (1 week)**
   - Extend automated tests (unit + integration).
   - Run cross-platform manual sessions (macOS, Linux, Windows WSL).
   - Capture demo assets and pilot feedback.

## Dependencies
- Ink or alternative CLI framework adoption (evaluate licensing and bundle size).
- Coordination with Support Ops for transcript review expectations.
- Storage plan for generated logs (respecting `.gitignore`/cleanup).

## Risks & Mitigations
- **Increased complexity for newcomers:** Keep Guided mode as default and thoroughly user-test copy.
- **Transcript leakage:** Implement strict redaction utilities and optional opt-out flag.
- **CLI library weight:** Bundle via ESM loader with tree-shaking; monitor install footprint.

## Open Questions
1. Should transcripts automatically attach to support Slack webhook when `--share-support` flag is used?
2. Do we need localized copy (en/es/pt) for high-volume regions?
3. How do we manage version skew when resuming from checkpoints after code changes?

## Requested Reviewers
- Engineering: CLI/Tooling squad
- Support Ops representative
- Product or UX designer for accessibility audit
