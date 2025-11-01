import EventEmitter from 'node:events';
import path from 'node:path';
import { readPreferences, writePreferences, getDefaultPreferences } from './preferences.mjs';
import { Transcript } from '../artifacts/transcript.mjs';

export class SetupContext extends EventEmitter {
  constructor(rootDir) {
    super();
    this.rootDir = rootDir;
    this.preferences = getDefaultPreferences();
    this.mode = 'guided';
    this.transcript = new Transcript(rootDir);
    this.decisions = {};
    this.errors = [];
    this.resumeCheckpoint = null;
    this.glossaryVisible = false;
    this.verbose = true;
    this.currentPhase = null;
    this.noColor = process.env.NO_COLOR === '1';
    this.highContrast = process.env.FORCE_HIGH_CONTRAST === '1';
  }

  async initialize() {
    this.preferences = await readPreferences(this.rootDir);
    if (this.preferences.mode) {
      this.mode = this.preferences.mode;
    }
    this.verbose = this.mode === 'guided';
    this.emit('preferencesLoaded', this.preferences);
  }

  setMode(mode, { reason = 'manual' } = {}) {
    if (mode !== 'guided' && mode !== 'expert') return;
    if (this.mode === mode) return;
    this.mode = mode;
    this.verbose = mode === 'guided';
    this.preferences.mode = mode;
    this.transcript.noteModeChange(mode);
    this.emit('modeChange', { mode, reason });
  }

  toggleMode({ reason = 'hotkey' } = {}) {
    const next = this.mode === 'guided' ? 'expert' : 'guided';
    this.setMode(next, { reason });
    return this.mode;
  }

  recordDecision(key, value) {
    this.decisions[key] = value;
    this.transcript.record('decision', { key, value });
    this.emit('decision', { key, value });
  }

  appendError(err) {
    const message = typeof err === 'string' ? err : err?.message || 'Unknown error';
    this.errors.push(message);
    this.transcript.record('error', { message });
    this.emit('error', { message });
  }

  markCheckpoint(id, status = 'completed') {
    this.transcript.noteCheckpoint(id, status);
    this.emit('checkpoint', { id, status });
  }

  setResumeHint(checkpoint) {
    this.resumeCheckpoint = checkpoint;
    this.emit('resumeHint', { checkpoint });
  }

  noteGlossaryViewed() {
    this.glossaryVisible = true;
    this.preferences.glossarySeen = true;
    this.transcript.openGlossary();
    this.emit('glossary');
  }

  trackPhase(phase) {
    this.currentPhase = phase;
    this.transcript.record('phase', { id: phase.id, title: phase.title });
    this.emit('phaseChange', phase);
  }

  log(type, payload) {
    this.transcript.record(type, payload);
    this.emit('log', { type, payload });
  }

  getRootedPath(relative) {
    return path.join(this.rootDir, relative);
  }

  async finalize(status) {
    const warnings = [];
    try {
      await writePreferences(this.rootDir, this.preferences);
    } catch (error) {
      const message = error?.message || 'Failed to persist setup preferences.';
      this.transcript.record('warning', { scope: 'preferences', message });
      this.emit('preferenceWriteFailed', { error });
      warnings.push({ type: 'preferences', error });
    }

    let transcriptPath = null;
    let jsonPath = null;
    try {
      const artifact = await this.transcript.finalize({
        status,
        errors: this.errors,
        decisions: this.decisions,
        resumeHint: this.resumeCheckpoint
      });
      transcriptPath = artifact.transcriptPath;
      jsonPath = artifact.jsonPath;
    } catch (error) {
      this.emit('transcriptWriteFailed', { error });
      throw error;
    }

    this.emit('finalized', { transcriptPath, jsonPath, status, warnings });
    return { transcriptPath, jsonPath, warnings };
  }
}
