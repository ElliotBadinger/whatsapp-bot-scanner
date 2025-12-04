/**
 * Interactive Hotkey System
 * Real-time keyboard shortcuts with visual feedback
 */

import readline from 'node:readline';
import chalk from 'chalk';

// ─────────────────────────────────────────────────────────────────────────────
// Color Palette
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  primary: chalk.hex('#00D9FF'),
  accent: chalk.hex('#FFB347'),
  success: chalk.hex('#00E676'),
  warning: chalk.hex('#FFD54F'),
  error: chalk.hex('#FF5252'),
  muted: chalk.hex('#6B7280'),
  text: chalk.white,
  textBold: chalk.white.bold,
  code: chalk.hex('#A78BFA'),
};

// ─────────────────────────────────────────────────────────────────────────────
// Hotkey Definitions
// ─────────────────────────────────────────────────────────────────────────────

const HOTKEYS = [
  { key: 'V', action: 'verbosity', description: 'Toggle verbose mode' },
  { key: 'G', action: 'glossary', description: 'Show glossary' },
  { key: 'R', action: 'recovery', description: 'Recovery options' },
  { key: 'H', action: 'help', description: 'Show hotkeys' },
  { key: 'Q', action: 'quit', description: 'Abort setup' },
];

const GLOSSARY = [
  { term: 'Guided Mode', definition: 'Step-by-step setup with detailed explanations' },
  { term: 'Expert Mode', definition: 'Condensed output for experienced users' },
  { term: 'Checkpoint', definition: 'Saved progress point for resume capability' },
  { term: 'Transcript', definition: 'Log file recording all setup decisions' },
  { term: 'Quick Action', description: 'Shortcut commands like --quick=preflight' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get hotkey description string (compact)
 */
export function describeHotkeys() {
  return HOTKEYS
    .map(h => `${C.accent(h.key)}:${h.description}`)
    .join(C.muted(' │ '));
}

/**
 * Get hotkey description string (formatted for display)
 */
export function getHotkeyHelp() {
  const lines = [
    '',
    C.textBold('  Keyboard Shortcuts:'),
    '',
  ];
  
  for (const h of HOTKEYS) {
    lines.push(`    ${C.accent(h.key)}  ${C.muted('→')}  ${C.text(h.description)}`);
  }
  
  lines.push('');
  return lines.join('\n');
}

/**
 * Display glossary panel
 */
function showGlossary(output) {
  output.heading('Glossary');
  
  for (const item of GLOSSARY) {
    console.log(`  ${C.textBold(item.term)}`);
    console.log(`     ${C.muted(item.definition)}`);
    console.log('');
  }
}

/**
 * Register hotkey listeners
 * @param {Object} context - Setup context
 * @param {Object} output - Output helper
 * @param {Object} recoveryManager - Recovery manager
 * @returns {Function} Cleanup function
 */
export function registerHotkeys(context, output, recoveryManager) {
  // Skip in non-TTY environments
  if (!process.stdin.isTTY) {
    return () => {};
  }
  
  // Enable keypress events
  readline.emitKeypressEvents(process.stdin);
  
  if (process.stdin.setRawMode) {
    try {
      process.stdin.setRawMode(true);
    } catch {
      // Some environments don't support raw mode
      return () => {};
    }
  }
  
  /**
   * Handle keypress events
   */
  function handleKeypress(key, data) {
    // Handle Ctrl+C
    if (data?.ctrl && data?.name === 'c') {
      console.log(C.warning('\n\n⚠  Setup cancelled by user.'));
      context.appendError('Setup aborted by user');
      context.finalize('aborted').finally(() => process.exit(1));
      return;
    }
    
    const char = typeof key === 'string' ? key.toUpperCase() : '';
    
    switch (char) {
      case 'V': {
        // Toggle verbosity mode
        const newMode = context.toggleMode({ reason: 'hotkey' });
        const modeLabel = newMode === 'guided' ? 'Verbose' : 'Compact';
        console.log(`\n  ${C.success('✓')}  ${C.text(`Switched to ${modeLabel} mode`)}\n`);
        context.recordDecision('mode', newMode);
        break;
      }
      
      case 'G': {
        // Toggle glossary
        context.glossaryVisible = !context.glossaryVisible;
        if (context.glossaryVisible) {
          context.noteGlossaryViewed();
          showGlossary(output);
        } else {
          console.log(`\n  ${C.muted('Glossary hidden')}\n`);
        }
        break;
      }
      
      case 'R': {
        // Show recovery options
        if (recoveryManager?.displayQuickActions) {
          recoveryManager.displayQuickActions();
        } else {
          console.log(`\n  ${C.textBold('Recovery Options:')}`);
          console.log(`    ${C.code('./setup.sh --quick=preflight')}    ${C.muted('Run preflight only')}`);
          console.log(`    ${C.code('./setup.sh --quick=resume-docker')} ${C.muted('Resume from Docker')}`);
          console.log(`    ${C.code('./setup.sh --quick=purge-caches')}  ${C.muted('Clear caches')}\n`);
        }
        break;
      }
      
      case 'H': {
        // Show hotkey help
        console.log(getHotkeyHelp());
        break;
      }
      
      case 'Q': {
        // Quit/abort
        console.log(C.warning('\n\n⚠  Aborting setup...'));
        context.appendError('Setup aborted via hotkey');
        context.finalize('aborted').finally(() => process.exit(1));
        break;
      }
      
      default:
        // Ignore other keys
        break;
    }
  }
  
  // Attach listener
  process.stdin.on('keypress', handleKeypress);
  
  // Show hotkey hint
  console.log(`\n  ${C.muted('Hotkeys:')} ${describeHotkeys()}\n`);
  
  // Return cleanup function
  return () => {
    process.stdin.removeListener('keypress', handleKeypress);
    if (process.stdin.setRawMode) {
      try {
        process.stdin.setRawMode(false);
      } catch {
        // Ignore cleanup errors
      }
    }
  };
}

export default { registerHotkeys, describeHotkeys, getHotkeyHelp };
