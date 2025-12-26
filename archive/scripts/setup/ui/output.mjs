/**
 * Enhanced Output System
 * Cohesive, beautiful terminal output with context awareness
 */

import chalk from 'chalk';

// ─────────────────────────────────────────────────────────────────────────────
// Color Palette
// ─────────────────────────────────────────────────────────────────────────────

const COLORS = {
  primary: chalk.hex('#00D9FF'),
  primaryBold: chalk.hex('#00D9FF').bold,
  accent: chalk.hex('#FFB347'),
  accentBold: chalk.hex('#FFB347').bold,
  success: chalk.hex('#00E676'),
  successBold: chalk.hex('#00E676').bold,
  warning: chalk.hex('#FFD54F'),
  warningBold: chalk.hex('#FFD54F').bold,
  error: chalk.hex('#FF5252'),
  errorBold: chalk.hex('#FF5252').bold,
  muted: chalk.hex('#6B7280'),
  mutedLight: chalk.hex('#9CA3AF'),
  text: chalk.white,
  textBold: chalk.white.bold,
  code: chalk.hex('#A78BFA'),
  link: chalk.hex('#60A5FA').underline,
};

// High contrast theme for accessibility
const HIGH_CONTRAST = {
  primary: chalk.bold.white,
  primaryBold: chalk.bold.white,
  accent: chalk.bold.yellow,
  accentBold: chalk.bold.yellow,
  success: chalk.bold.green,
  successBold: chalk.bold.green,
  warning: chalk.bold.yellow,
  warningBold: chalk.bold.yellow,
  error: chalk.bold.red,
  errorBold: chalk.bold.red,
  muted: chalk.gray,
  mutedLight: chalk.white,
  text: chalk.white,
  textBold: chalk.bold.white,
  code: chalk.cyan,
  link: chalk.blue.underline,
};

// No-color theme
const NO_COLOR = Object.fromEntries(
  Object.keys(COLORS).map(k => [k, (v) => v])
);

const ICONS = {
  success: '✓',
  error: '✗',
  warning: '⚠',
  info: 'ℹ',
  arrow: '→',
  chevron: '›',
  bullet: '•',
};

// ─────────────────────────────────────────────────────────────────────────────
// Theme Selection
// ─────────────────────────────────────────────────────────────────────────────

function getTheme(context) {
  if (context.noColor) {
    return NO_COLOR;
  }
  if (context.highContrast) {
    return HIGH_CONTRAST;
  }
  return COLORS;
}

// ─────────────────────────────────────────────────────────────────────────────
// Output Factory
// ─────────────────────────────────────────────────────────────────────────────

export function createOutput(context) {
  const theme = getTheme(context);
  
  /**
   * Internal emit function with logging
   */
  function emit(level, icon, renderer, message, data = {}) {
    const iconStr = icon ? `${icon}  ` : '';
    const formatted = renderer(message);
    
    if (context.verbose || level === 'error' || level === 'warn' || level === 'success') {
      console.log(`${iconStr}${formatted}`);
    }
    
    // Log to context transcript
    context.log('output', { level, message, ...data });
  }

  return {
    // ─────────────────────────────────────────────────────────────────────────
    // Structural Elements
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Section heading
     */
    heading(text, options = {}) {
      const { step = null, total = null, icon = null } = options;
      
      console.log('');
      console.log(theme.muted('─'.repeat(60)));
      
      let header = '';
      if (step && total) {
        header += theme.accent(`[${step}/${total}] `);
      }
      if (icon) {
        header += `${icon} `;
      }
      header += theme.textBold(text);
      
      console.log(header);
      console.log(theme.muted('─'.repeat(60)));
      
      context.log('heading', { text, step, total });
    },

    /**
     * Sub-heading (less prominent)
     */
    subheading(text) {
      console.log('');
      console.log(theme.accentBold(text));
      context.log('subheading', { text });
    },

    /**
     * Horizontal divider
     */
    divider() {
      if (context.verbose) {
        console.log(theme.muted('─'.repeat(40)));
      }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Status Messages
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Information message
     */
    info(message, data = {}) {
      emit('info', theme.primary(ICONS.info), theme.text, message, data);
    },

    /**
     * Success message
     */
    success(message, data = {}) {
      emit('success', theme.success(ICONS.success), theme.success, message, data);
    },

    /**
     * Warning message
     */
    warn(message, data = {}) {
      emit('warn', theme.warning(ICONS.warning), theme.warning, message, data);
    },

    /**
     * Error message
     */
    error(message, data = {}) {
      emit('error', theme.error(ICONS.error), theme.error, message, data);
    },

    /**
     * Note/verbose message (only shown in verbose mode)
     */
    note(message) {
      if (context.verbose) {
        console.log(theme.muted(`   ${ICONS.chevron} ${message}`));
      }
      context.log('note', { message });
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Special Formats
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Step indicator
     */
    step(message) {
      console.log(`${theme.primary(ICONS.arrow)}  ${theme.text(message)}`);
      context.log('step', { message });
    },

    /**
     * Command suggestion
     */
    command(cmd) {
      console.log(`   ${theme.code('$ ' + cmd)}`);
    },

    /**
     * URL/link display
     */
    link(url, label = null) {
      const display = label 
        ? `${theme.text(label + ': ')}${theme.link(url)}`
        : theme.link(url);
      console.log(`   ${display}`);
    },

    /**
     * Key-value pair
     */
    keyValue(key, value, options = {}) {
      const { keyWidth = 24 } = options;
      const paddedKey = key.padEnd(keyWidth);
      console.log(`  ${theme.muted(paddedKey)} ${theme.text(value)}`);
    },

    /**
     * Bullet point
     */
    bullet(message) {
      console.log(`  ${theme.muted(ICONS.bullet)} ${theme.text(message)}`);
    },

    /**
     * Numbered item
     */
    numbered(index, message) {
      console.log(`  ${theme.muted(index + '.')} ${theme.text(message)}`);
    },

    /**
     * Code block
     */
    codeBlock(code) {
      const lines = Array.isArray(code) ? code : code.split('\n');
      console.log(theme.muted('   ┌' + '─'.repeat(50)));
      for (const line of lines) {
        console.log(theme.muted('   │ ') + theme.code(line));
      }
      console.log(theme.muted('   └' + '─'.repeat(50)));
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Complex Components
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Box with content
     */
    box(content, options = {}) {
      const { title = null, borderColor = theme.primary, style = 'single' } = options;
      
      const chars = style === 'double'
        ? { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' }
        : { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' };
      
      const lines = Array.isArray(content) ? content : content.split('\n');
      const maxLen = Math.max(...lines.map(l => stripAnsi(l).length));
      const width = Math.max(maxLen + 4, 40);
      
      // Top border
      let top = borderColor(chars.tl + chars.h.repeat(width) + chars.tr);
      if (title) {
        const titlePos = Math.floor((width - title.length - 2) / 2);
        top = borderColor(chars.tl + chars.h.repeat(titlePos)) + 
              ` ${theme.textBold(title)} ` + 
              borderColor(chars.h.repeat(width - titlePos - title.length - 2) + chars.tr);
      }
      console.log(top);
      
      // Content
      for (const line of lines) {
        const padding = ' '.repeat(Math.max(0, width - stripAnsi(line).length - 2));
        console.log(borderColor(chars.v) + ' ' + line + padding + ' ' + borderColor(chars.v));
      }
      
      // Bottom border
      console.log(borderColor(chars.bl + chars.h.repeat(width) + chars.br));
    },

    /**
     * Progress summary table
     */
    progressTable(items) {
      const maxLabel = Math.max(...items.map(i => i.label.length));
      
      for (const item of items) {
        const icon = item.status === 'done' ? theme.success(ICONS.success) :
                     item.status === 'current' ? theme.accent('◉') :
                     item.status === 'error' ? theme.error(ICONS.error) :
                     theme.muted('○');
        
        const label = item.status === 'current' 
          ? theme.accentBold(item.label.padEnd(maxLabel))
          : item.status === 'done'
            ? theme.muted(item.label.padEnd(maxLabel))
            : theme.muted(item.label.padEnd(maxLabel));
        
        const detail = item.detail 
          ? theme.muted(` (${item.detail})`)
          : '';
        
        console.log(`  ${icon}  ${label}${detail}`);
      }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Utility
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Empty line
     */
    newline(count = 1) {
      for (let i = 0; i < count; i++) {
        console.log('');
      }
    },

    /**
     * Clear screen
     */
    clear() {
      if (process.stdout.isTTY) {
        console.clear();
      }
    },

    /**
     * Raw console output
     */
    raw(text) {
      console.log(text);
    },

    /**
     * Get the theme object for custom styling
     */
    getTheme() {
      return theme;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strip ANSI codes for length calculation
 */
function stripAnsi(str) {
  return String(str).replace(/\x1b\[[0-9;]*m/g, '');
}

export default createOutput;
