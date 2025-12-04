/**
 * Terminal Theme System
 * A cohesive, modern terminal aesthetic for WhatsApp Bot Scanner
 * 
 * Design Philosophy:
 * - Minimal but impactful: Every visual element has purpose
 * - High contrast: Works on light and dark terminals
 * - Distinctive brand: Recognizable at a glance
 * - Accessible: Clear hierarchy without relying solely on color
 */

import chalk from 'chalk';

// ─────────────────────────────────────────────────────────────────────────────
// Color Palette
// ─────────────────────────────────────────────────────────────────────────────

const COLORS = {
  // Primary: A distinctive teal-cyan gradient feel
  primary: chalk.hex('#00D9FF'),
  primaryDim: chalk.hex('#0099B3'),
  primaryBold: chalk.hex('#00D9FF').bold,
  
  // Accent: Warm amber for highlights and calls to action
  accent: chalk.hex('#FFB347'),
  accentBold: chalk.hex('#FFB347').bold,
  
  // Success: Fresh green
  success: chalk.hex('#00E676'),
  successBold: chalk.hex('#00E676').bold,
  
  // Warning: Soft amber
  warning: chalk.hex('#FFD54F'),
  warningBold: chalk.hex('#FFD54F').bold,
  
  // Error: Vibrant coral red
  error: chalk.hex('#FF5252'),
  errorBold: chalk.hex('#FF5252').bold,
  
  // Muted: For secondary info, timestamps, hints
  muted: chalk.hex('#6B7280'),
  mutedLight: chalk.hex('#9CA3AF'),
  
  // Text
  text: chalk.white,
  textBold: chalk.white.bold,
  textDim: chalk.gray,
  
  // Special
  code: chalk.hex('#A78BFA'),  // Purple for codes/commands
  link: chalk.hex('#60A5FA').underline,  // Blue for links
  highlight: chalk.bgHex('#1E3A5F').hex('#00D9FF'),
};

// ─────────────────────────────────────────────────────────────────────────────
// Box Drawing Characters (Unicode)
// ─────────────────────────────────────────────────────────────────────────────

const BOX = {
  // Single line
  topLeft: '╭',
  topRight: '╮',
  bottomLeft: '╰',
  bottomRight: '╯',
  horizontal: '─',
  vertical: '│',
  
  // Double line (for emphasis)
  dTopLeft: '╔',
  dTopRight: '╗',
  dBottomLeft: '╚',
  dBottomRight: '╝',
  dHorizontal: '═',
  dVertical: '║',
  
  // T-junctions
  tLeft: '├',
  tRight: '┤',
  
  // Arrows & bullets
  arrow: '→',
  bullet: '•',
  diamond: '◆',
  check: '✓',
  cross: '✗',
  star: '★',
  
  // Progress elements
  filled: '█',
  partial: '▓',
  empty: '░',
  dot: '●',
  ring: '○',
};

// ─────────────────────────────────────────────────────────────────────────────
// Symbols & Icons
// ─────────────────────────────────────────────────────────────────────────────

const ICONS = {
  // Status
  success: COLORS.success('✓'),
  error: COLORS.error('✗'),
  warning: COLORS.warning('⚠'),
  info: COLORS.primary('ℹ'),
  
  // Steps
  pending: COLORS.muted('○'),
  active: COLORS.accent('◉'),
  complete: COLORS.success('●'),
  skipped: COLORS.muted('◌'),
  
  // Actions
  rocket: '🚀',
  shield: '🛡️',
  phone: '📱',
  key: '🔑',
  lock: '🔒',
  gear: '⚙️',
  check: '✅',
  sparkle: '✨',
  lightning: '⚡',
  package: '📦',
  docker: '🐳',
  timer: '⏱️',
  
  // Arrows & indicators
  arrowRight: COLORS.primary('→'),
  arrowDown: COLORS.primary('↓'),
  chevron: COLORS.muted('›'),
};

// ─────────────────────────────────────────────────────────────────────────────
// Layout Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get terminal width, with fallback
 */
function getTerminalWidth() {
  return process.stdout.columns || 80;
}

/**
 * Center text within terminal width
 */
function centerText(text, width = null) {
  const termWidth = width || getTerminalWidth();
  const stripped = stripAnsi(text);
  const padding = Math.max(0, Math.floor((termWidth - stripped.length) / 2));
  return ' '.repeat(padding) + text;
}

/**
 * Strip ANSI codes for length calculation
 */
function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Create horizontal line
 */
function horizontalLine(char = BOX.horizontal, width = null) {
  const termWidth = width || getTerminalWidth();
  return COLORS.muted(char.repeat(Math.min(termWidth, 80)));
}

/**
 * Pad text to width
 */
function padText(text, width, align = 'left') {
  const stripped = stripAnsi(text);
  const diff = width - stripped.length;
  if (diff <= 0) return text;
  
  if (align === 'center') {
    const left = Math.floor(diff / 2);
    const right = diff - left;
    return ' '.repeat(left) + text + ' '.repeat(right);
  } else if (align === 'right') {
    return ' '.repeat(diff) + text;
  }
  return text + ' '.repeat(diff);
}

// ─────────────────────────────────────────────────────────────────────────────
// Component: Box
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a bordered box with content
 */
function createBox(content, options = {}) {
  const {
    title = null,
    padding = 1,
    borderColor = COLORS.primary,
    width = null,
    style = 'single',  // 'single', 'double', 'heavy'
  } = options;
  
  const chars = style === 'double' 
    ? { tl: BOX.dTopLeft, tr: BOX.dTopRight, bl: BOX.dBottomLeft, br: BOX.dBottomRight, h: BOX.dHorizontal, v: BOX.dVertical }
    : { tl: BOX.topLeft, tr: BOX.topRight, bl: BOX.bottomLeft, br: BOX.bottomRight, h: BOX.horizontal, v: BOX.vertical };
  
  const lines = Array.isArray(content) ? content : content.split('\n');
  const maxContentWidth = Math.max(...lines.map(l => stripAnsi(l).length));
  const boxWidth = width || Math.min(maxContentWidth + (padding * 2) + 2, getTerminalWidth() - 4);
  const innerWidth = boxWidth - 2;
  
  const result = [];
  
  // Top border
  let topLine = borderColor(chars.tl + chars.h.repeat(innerWidth) + chars.tr);
  if (title) {
    const titleText = ` ${title} `;
    const titleStart = Math.floor((innerWidth - titleText.length) / 2);
    topLine = borderColor(chars.tl + chars.h.repeat(titleStart)) + 
              COLORS.textBold(titleText) + 
              borderColor(chars.h.repeat(innerWidth - titleStart - titleText.length) + chars.tr);
  }
  result.push(topLine);
  
  // Padding top
  for (let i = 0; i < padding; i++) {
    result.push(borderColor(chars.v) + ' '.repeat(innerWidth) + borderColor(chars.v));
  }
  
  // Content lines
  for (const line of lines) {
    const paddedLine = ' '.repeat(padding) + line + ' '.repeat(Math.max(0, innerWidth - stripAnsi(line).length - padding));
    result.push(borderColor(chars.v) + paddedLine + borderColor(chars.v));
  }
  
  // Padding bottom
  for (let i = 0; i < padding; i++) {
    result.push(borderColor(chars.v) + ' '.repeat(innerWidth) + borderColor(chars.v));
  }
  
  // Bottom border
  result.push(borderColor(chars.bl + chars.h.repeat(innerWidth) + chars.br));
  
  return result.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Component: Progress Bar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a progress bar
 */
function progressBar(current, total, options = {}) {
  const {
    width = 30,
    showPercent = true,
    showCount = false,
    filled = BOX.filled,
    empty = BOX.empty,
    label = '',
  } = options;
  
  const percent = Math.min(100, Math.round((current / total) * 100));
  const filledCount = Math.round((percent / 100) * width);
  const emptyCount = width - filledCount;
  
  const bar = COLORS.success(filled.repeat(filledCount)) + COLORS.muted(empty.repeat(emptyCount));
  
  let result = bar;
  if (showPercent) {
    result += COLORS.muted(` ${percent.toString().padStart(3)}%`);
  }
  if (showCount) {
    result += COLORS.muted(` (${current}/${total})`);
  }
  if (label) {
    result = COLORS.text(label + ' ') + result;
  }
  
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component: Step Indicator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create step progress indicator
 */
function stepIndicator(steps, currentIndex) {
  const parts = [];
  
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    let icon, textStyle;
    
    if (i < currentIndex) {
      icon = ICONS.complete;
      textStyle = COLORS.success;
    } else if (i === currentIndex) {
      icon = ICONS.active;
      textStyle = COLORS.accentBold;
    } else {
      icon = ICONS.pending;
      textStyle = COLORS.muted;
    }
    
    parts.push(`${icon} ${textStyle(step.name)}`);
  }
  
  return parts.join(COLORS.muted('  │  '));
}

/**
 * Create vertical step list
 */
function stepList(steps, currentIndex, options = {}) {
  const { showEstimate = true, compact = false } = options;
  const lines = [];
  
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    let connector, icon, nameStyle, estimateStyle;
    
    if (i < currentIndex) {
      // Completed
      connector = COLORS.success(BOX.vertical);
      icon = COLORS.success(BOX.check);
      nameStyle = COLORS.muted;
      estimateStyle = COLORS.muted;
    } else if (i === currentIndex) {
      // Active
      connector = COLORS.accent(BOX.vertical);
      icon = COLORS.accent(BOX.dot);
      nameStyle = COLORS.accentBold;
      estimateStyle = COLORS.accent;
    } else {
      // Pending
      connector = COLORS.muted(BOX.vertical);
      icon = COLORS.muted(BOX.ring);
      nameStyle = COLORS.muted;
      estimateStyle = COLORS.muted;
    }
    
    // Step line
    const estimate = showEstimate && step.estimate ? estimateStyle(` (${step.estimate})`) : '';
    lines.push(`  ${icon}  ${nameStyle(step.name)}${estimate}`);
    
    // Connector line (except for last)
    if (!compact && i < steps.length - 1) {
      lines.push(`  ${connector}`);
    }
  }
  
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Component: Large Code Display
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create large, attention-grabbing code display
 */
function largeCode(code, options = {}) {
  const { title = 'CODE', subtitle = null, countdown = null } = options;
  
  // Format code with spaces between characters for readability
  const formattedCode = code.split('').join(' ');
  
  const lines = [];
  
  if (title) {
    lines.push(COLORS.accent(title));
  }
  
  lines.push('');
  lines.push(COLORS.primaryBold('  ╔════════════════════════════════════╗'));
  lines.push(COLORS.primaryBold('  ║                                    ║'));
  lines.push(COLORS.primaryBold('  ║    ') + chalk.bgHex('#003344').hex('#00D9FF').bold(`    ${formattedCode}    `) + COLORS.primaryBold('    ║'));
  lines.push(COLORS.primaryBold('  ║                                    ║'));
  lines.push(COLORS.primaryBold('  ╚════════════════════════════════════╝'));
  lines.push('');
  
  if (countdown) {
    lines.push(COLORS.warning(`  ${ICONS.timer}  Expires in: ${countdown}`));
  }
  
  if (subtitle) {
    lines.push(COLORS.muted(`  ${subtitle}`));
  }
  
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Component: Header/Banner
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create the main application banner
 */
function banner(options = {}) {
  const { version = '2.0', compact = false } = options;
  
  if (compact) {
    return [
      '',
      COLORS.primaryBold('  ╭──────────────────────────────────────────╮'),
      COLORS.primaryBold('  │') + '  ' + ICONS.shield + ' ' + COLORS.textBold('WhatsApp Bot Scanner') + '           ' + COLORS.primaryBold('│'),
      COLORS.primaryBold('  │') + '  ' + COLORS.muted(`Setup Wizard v${version}`) + '                    ' + COLORS.primaryBold('│'),
      COLORS.primaryBold('  ╰──────────────────────────────────────────╯'),
      '',
    ].join('\n');
  }
  
  // Full ASCII art banner - distinctive shield design
  return [
    '',
    COLORS.primary('        ╔═══════════════════════════════════════════════════════╗'),
    COLORS.primary('        ║') + '                                                         ' + COLORS.primary('║'),
    COLORS.primary('        ║') + COLORS.primaryBold('              ██╗    ██╗██████╗ ███████╗               ') + COLORS.primary('║'),
    COLORS.primary('        ║') + COLORS.primaryBold('              ██║    ██║██╔══██╗██╔════╝               ') + COLORS.primary('║'),
    COLORS.primary('        ║') + COLORS.primaryBold('              ██║ █╗ ██║██████╔╝███████╗               ') + COLORS.primary('║'),
    COLORS.primary('        ║') + COLORS.primaryBold('              ██║███╗██║██╔══██╗╚════██║               ') + COLORS.primary('║'),
    COLORS.primary('        ║') + COLORS.primaryBold('              ╚███╔███╔╝██████╔╝███████║               ') + COLORS.primary('║'),
    COLORS.primary('        ║') + COLORS.primaryBold('               ╚══╝╚══╝ ╚═════╝ ╚══════╝               ') + COLORS.primary('║'),
    COLORS.primary('        ║') + '                                                         ' + COLORS.primary('║'),
    COLORS.primary('        ║') + '     ' + ICONS.shield + ' ' + COLORS.textBold('WhatsApp Bot Scanner') + '  ' + COLORS.muted('|') + '  ' + COLORS.accent(`Setup v${version}`) + '          ' + COLORS.primary('║'),
    COLORS.primary('        ║') + '     ' + COLORS.muted('Protect your groups from malicious links') + '           ' + COLORS.primary('║'),
    COLORS.primary('        ║') + '                                                         ' + COLORS.primary('║'),
    COLORS.primary('        ╚═══════════════════════════════════════════════════════╝'),
    '',
  ].join('\n');
}

/**
 * Create section header
 */
function sectionHeader(title, options = {}) {
  const { icon = null, step = null, total = null } = options;
  const width = Math.min(60, getTerminalWidth() - 10);
  
  let header = '';
  if (step && total) {
    header += COLORS.accent(`Step ${step}/${total}: `);
  }
  if (icon) {
    header += icon + ' ';
  }
  header += COLORS.textBold(title);
  
  const line = COLORS.muted(BOX.horizontal.repeat(width));
  
  return `\n${line}\n${header}\n${line}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component: Messages
// ─────────────────────────────────────────────────────────────────────────────

const msg = {
  info: (text) => `${ICONS.info}  ${COLORS.text(text)}`,
  success: (text) => `${ICONS.success}  ${COLORS.success(text)}`,
  warning: (text) => `${ICONS.warning}  ${COLORS.warning(text)}`,
  error: (text) => `${ICONS.error}  ${COLORS.error(text)}`,
  step: (text) => `${ICONS.arrowRight}  ${COLORS.text(text)}`,
  hint: (text) => `   ${COLORS.muted(BOX.chevron + ' ' + text)}`,
  command: (cmd) => `   ${COLORS.code('$ ' + cmd)}`,
  link: (url) => COLORS.link(url),
  dim: (text) => COLORS.muted(text),
  bold: (text) => COLORS.textBold(text),
  code: (text) => COLORS.code(text),
};

// ─────────────────────────────────────────────────────────────────────────────
// Component: Tables
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a simple key-value display
 */
function keyValueList(items, options = {}) {
  const { indent = 2, separator = ':' } = options;
  
  const maxKeyLen = Math.max(...items.map(([k]) => k.length));
  const prefix = ' '.repeat(indent);
  
  return items
    .map(([key, value]) => {
      const paddedKey = key.padEnd(maxKeyLen);
      return `${prefix}${COLORS.muted(paddedKey)}${COLORS.muted(separator)} ${COLORS.text(value)}`;
    })
    .join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Component: Final Summary
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create completion summary box
 */
function completionSummary(options = {}) {
  const {
    dashboardUrl = 'http://localhost:8088',
    grafanaUrl = 'http://localhost:3002',
    uptimeUrl = 'http://localhost:3001',
    orchestratorUrl = 'http://localhost:3003/healthz',
  } = options;
  
  const lines = [
    '',
    COLORS.successBold('  ╔══════════════════════════════════════════════════════════╗'),
    COLORS.successBold('  ║') + '                                                          ' + COLORS.successBold('║'),
    COLORS.successBold('  ║') + '      ' + ICONS.sparkle + ' ' + COLORS.successBold('Setup Complete!') + '  Your bot is now active.       ' + COLORS.successBold('║'),
    COLORS.successBold('  ║') + '                                                          ' + COLORS.successBold('║'),
    COLORS.successBold('  ╚══════════════════════════════════════════════════════════╝'),
    '',
    COLORS.textBold('  Access Points:'),
    '',
    `    ${ICONS.arrowRight}  Dashboard:         ${COLORS.link(dashboardUrl)}`,
    `    ${ICONS.arrowRight}  Uptime Monitor:    ${COLORS.link(uptimeUrl)}`,
    `    ${ICONS.arrowRight}  Scan Orchestrator: ${COLORS.link(orchestratorUrl)}`,
    `    ${ICONS.arrowRight}  Grafana:           ${COLORS.link(grafanaUrl)} ${COLORS.muted('(admin/admin)')}`,
    '',
    COLORS.muted('  Quick Commands:'),
    '',
    `    ${msg.command('npx whatsapp-bot-scanner logs')}      ${COLORS.muted('View logs')}`,
    `    ${msg.command('npx whatsapp-bot-scanner health')}    ${COLORS.muted('Check status')}`,
    `    ${msg.command('npx whatsapp-bot-scanner pair')}      ${COLORS.muted('Re-pair WhatsApp')}`,
    '',
  ].join('\n');
  
  return lines;
}

// ─────────────────────────────────────────────────────────────────────────────
// Export Theme
// ─────────────────────────────────────────────────────────────────────────────

export const theme = {
  colors: COLORS,
  box: BOX,
  icons: ICONS,
  
  // Layout
  getTerminalWidth,
  centerText,
  horizontalLine,
  padText,
  stripAnsi,
  
  // Components
  createBox,
  progressBar,
  stepIndicator,
  stepList,
  largeCode,
  banner,
  sectionHeader,
  keyValueList,
  completionSummary,
  
  // Messages
  msg,
};

export default theme;

