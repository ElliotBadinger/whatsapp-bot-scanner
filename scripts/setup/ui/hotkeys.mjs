import readline from 'node:readline';

const HOTKEY_DESCRIPTIONS = [
  { key: 'v', description: 'Toggle Guided ↔ Expert verbosity' },
  { key: 'g', description: 'Toggle glossary panel' },
  { key: 'r', description: 'Show recovery actions' },
  { key: 'h', description: 'List hotkeys' },
  { key: 'q', description: 'Abort setup safely' }
];

const GLOSSARY_ENTRIES = [
  ['Guided mode', 'Conversational narration with safety tips and visuals.'],
  ['Expert mode', 'Condensed status lines ideal for repeat operators.'],
  ['Checkpoint', 'Saved stage used for resume commands (preflight, environment, containers).'],
  ['Transcript', 'Markdown + JSON artifact capturing decisions and outcomes.'],
  ['Quick action', 'One-command helpers such as --quick=preflight or --quick=purge-caches.']
];

export function describeHotkeys() {
  return HOTKEY_DESCRIPTIONS.map(item => `${item.key.toUpperCase()}: ${item.description}`).join(' | ');
}

function renderGlossary(output) {
  output.heading('CLI Glossary');
  for (const [term, definition] of GLOSSARY_ENTRIES) {
    output.info(`${term}: ${definition}`);
  }
}

export function registerHotkeys(context, output, recoveryManager) {
  if (!process.stdin.isTTY) return () => {};
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.setRawMode) {
    process.stdin.setRawMode(true);
  }

  function handle(key, data) {
    if (data?.ctrl && data?.name === 'c') {
      output.warn('Received Ctrl+C, shutting down gracefully...');
      context.appendError('Setup aborted by user.');
      context.finalize('aborted').finally(() => process.exit(1));
      return;
    }
    const char = typeof key === 'string' ? key.toLowerCase() : '';
    switch (char) {
      case 'v': {
        const next = context.toggleMode({ reason: 'hotkey' });
        output.info(`Verbosity switched to ${next.toUpperCase()} mode.`);
        context.recordDecision('mode', next);
        break;
      }
      case 'g': {
        context.glossaryVisible = !context.glossaryVisible;
        if (context.glossaryVisible) {
          context.noteGlossaryViewed();
          output.info('Glossary panel opened. Key concepts explained below.');
          renderGlossary(output);
        } else {
          output.info('Glossary panel hidden.');
        }
        break;
      }
      case 'r': {
        recoveryManager?.displayQuickActions();
        break;
      }
      case 'h': {
        output.info(`Hotkeys: ${describeHotkeys()}`);
        break;
      }
      case 'q': {
        output.warn('Abort requested by user. Finishing partial transcript...');
        context.appendError('Setup aborted via hotkey.');
        context.finalize('aborted').finally(() => process.exit(1));
        break;
      }
      default:
        break;
    }
  }

  process.stdin.on('keypress', handle);
  output.info(`Hotkeys active → ${describeHotkeys()}`);

  return () => {
    process.stdin.removeListener('keypress', handle);
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(false);
    }
  };
}
