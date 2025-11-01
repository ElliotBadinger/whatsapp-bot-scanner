import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { scrubObject } from '../utils/redact.mjs';

function timestamp() {
  return new Date().toISOString();
}

function formatDuration(ms) {
  if (!Number.isFinite(ms)) return 'n/a';
  const sec = Math.round(ms / 100) / 10;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const minutes = Math.floor(sec / 60);
  const leftover = Math.round((sec % 60) * 10) / 10;
  return `${minutes}m ${leftover.toFixed(1)}s`;
}

export class Transcript {
  constructor(rootDir) {
    this.rootDir = rootDir;
    this.events = [];
    this.metadata = {
      modeChanges: [],
      checkpoints: [],
      glossaryOpened: false,
      accessibility: {
        noColor: process.env.NO_COLOR === '1',
        highContrast: process.env.FORCE_HIGH_CONTRAST === '1'
      }
    };
    this.startedAt = Date.now();
  }

  record(type, payload = {}) {
    this.events.push({
      type,
      at: timestamp(),
      ...scrubObject(payload)
    });
  }

  noteModeChange(mode) {
    this.metadata.modeChanges.push({ mode, at: timestamp() });
  }

  noteCheckpoint(id, status) {
    this.metadata.checkpoints.push({ id, status, at: timestamp() });
  }

  openGlossary() {
    this.metadata.glossaryOpened = true;
  }

  annotate(meta) {
    this.metadata = { ...this.metadata, ...scrubObject(meta) };
  }

  async finalize({ status, errors = [], decisions = {}, resumeHint = null } = {}) {
    const endedAt = Date.now();
    const duration = endedAt - this.startedAt;
    const logsDir = path.join(this.rootDir, 'logs');
    await fs.mkdir(logsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
    const baseName = `setup-${stamp}`;
    const transcriptPath = path.join(logsDir, `${baseName}.md`);
    const jsonPath = path.join(logsDir, `${baseName}.json`);
    const header = [
      `# WhatsApp Bot Scanner • Setup Transcript`,
      ``,
      `- Started: ${new Date(this.startedAt).toISOString()}`,
      `- Completed: ${new Date(endedAt).toISOString()}`,
      `- Duration: ${formatDuration(duration)}`,
      `- Final status: ${status}`,
      resumeHint ? `- Resume hint: ${resumeHint}` : null,
      `- Mode changes: ${this.metadata.modeChanges.map(c => `${c.mode} @ ${c.at}`).join(', ') || 'Guided only'}`,
      ``
    ]
      .filter(Boolean)
      .join(os.EOL);
    const body = this.events
      .map(event => {
        const label = event.type.padEnd(12, ' ');
        const payload = { ...event };
        delete payload.type;
        delete payload.at;
        return `- ${event.at} • ${label} ${JSON.stringify(payload)}`;
      })
      .join(os.EOL);
    const footer = [
      ``,
      `## Decisions`,
      '```json',
      JSON.stringify(scrubObject(decisions), null, 2),
      '```',
      ``,
      `## Errors`,
      errors.length ? errors.map(err => `- ${err}`).join(os.EOL) : '- None recorded',
      ``,
      `## Metadata`,
      '```json',
      JSON.stringify(this.metadata, null, 2),
      '```',
      ``
    ].join(os.EOL);

    await fs.writeFile(transcriptPath, header + os.EOL + body + os.EOL + footer, 'utf8');
    await fs.writeFile(
      jsonPath,
      JSON.stringify(
        {
          startedAt: new Date(this.startedAt).toISOString(),
          endedAt: new Date(endedAt).toISOString(),
          durationMs: duration,
          status,
          events: this.events,
          decisions: scrubObject(decisions),
          errors,
          metadata: this.metadata,
          resumeHint
        },
        null,
        2
      ) + os.EOL,
      'utf8'
    );
    return { transcriptPath, jsonPath };
  }
}
