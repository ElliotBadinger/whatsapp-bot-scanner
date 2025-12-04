/**
 * Enhanced Notification Manager
 * Stunning, attention-grabbing notifications for critical events
 */

import { execa } from 'execa';
import chalk from 'chalk';
import readline from 'node:readline';

// ─────────────────────────────────────────────────────────────────────────────
// Color Palette
// ─────────────────────────────────────────────────────────────────────────────

const COLORS = {
  primary: chalk.hex('#00D9FF'),
  primaryBold: chalk.hex('#00D9FF').bold,
  primaryBg: chalk.bgHex('#003344').hex('#00D9FF'),
  accent: chalk.hex('#FFB347'),
  accentBold: chalk.hex('#FFB347').bold,
  success: chalk.hex('#00E676'),
  successBold: chalk.hex('#00E676').bold,
  warning: chalk.hex('#FFD54F'),
  warningBold: chalk.hex('#FFD54F').bold,
  error: chalk.hex('#FF5252'),
  muted: chalk.hex('#6B7280'),
  text: chalk.white,
  textBold: chalk.white.bold,
  
  // Special emphasis
  codeHighlight: chalk.bgHex('#1a2744').hex('#00ffcc').bold,
};

const ICONS = {
  phone: '📱',
  key: '🔑',
  timer: '⏱️',
  check: '✓',
  warning: '⚠',
  refresh: '🔄',
  bell: '🔔',
};

// ─────────────────────────────────────────────────────────────────────────────
// Notification Manager Class
// ─────────────────────────────────────────────────────────────────────────────

export class NotificationManager {
  constructor(ui) {
    this.ui = ui;
    this.currentDisplay = null;
    this.rl = null;
    this.audioEnabled = true;  // Can be disabled by user
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Pairing Notifications
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Trigger a pairing code alert with stunning visual display
   */
  triggerPairingAlert(code, phone, countdown = '02:00', callbacks = {}) {
    // Play audio alert (non-blocking)
    if (this.audioEnabled) {
      this.playAlertSound();
    }

    // Show the pairing display
    this.showPairingCodeDisplay(code, phone, countdown, callbacks);
  }

  /**
   * Display a large, impossible-to-miss pairing code
   */
  showPairingCodeDisplay(code, phone, countdown, callbacks = {}) {
    this.currentDisplay = {
      code,
      phone,
      countdown,
      onRefresh: callbacks.onRefresh,
      onComplete: callbacks.onComplete,
    };

    console.clear();
    
    // Format code with spaces for readability
    const formattedCode = code.split('').join(' ');
    const maskedPhone = phone ? maskPhone(phone) : 'Not provided';
    
    // Build the display
    const display = `
${COLORS.primary('╔══════════════════════════════════════════════════════════════════════════════╗')}
${COLORS.primary('║')}                                                                              ${COLORS.primary('║')}
${COLORS.primary('║')}       ${ICONS.key}  ${COLORS.accentBold('WHATSAPP PAIRING CODE REQUIRED')}                                    ${COLORS.primary('║')}
${COLORS.primary('║')}                                                                              ${COLORS.primary('║')}
${COLORS.primary('║')}       Open WhatsApp on your phone and enter this code:                       ${COLORS.primary('║')}
${COLORS.primary('║')}                                                                              ${COLORS.primary('║')}
${COLORS.primary('║')}       ${COLORS.primary('┌────────────────────────────────────────────────────────────┐')}       ${COLORS.primary('║')}
${COLORS.primary('║')}       ${COLORS.primary('│')}                                                            ${COLORS.primary('│')}       ${COLORS.primary('║')}
${COLORS.primary('║')}       ${COLORS.primary('│')}           ${COLORS.codeHighlight(`    ${formattedCode}    `)}               ${COLORS.primary('│')}       ${COLORS.primary('║')}
${COLORS.primary('║')}       ${COLORS.primary('│')}                                                            ${COLORS.primary('│')}       ${COLORS.primary('║')}
${COLORS.primary('║')}       ${COLORS.primary('└────────────────────────────────────────────────────────────┘')}       ${COLORS.primary('║')}
${COLORS.primary('║')}                                                                              ${COLORS.primary('║')}
${COLORS.primary('║')}       ${ICONS.phone}  Phone: ${COLORS.text(maskedPhone.padEnd(20))}                                      ${COLORS.primary('║')}
${COLORS.primary('║')}       ${ICONS.timer}  Expires in: ${COLORS.warning(countdown)}                                              ${COLORS.primary('║')}
${COLORS.primary('║')}                                                                              ${COLORS.primary('║')}
${COLORS.primary('╠══════════════════════════════════════════════════════════════════════════════╣')}
${COLORS.primary('║')}                                                                              ${COLORS.primary('║')}
${COLORS.primary('║')}       ${COLORS.textBold('Steps:')}                                                                   ${COLORS.primary('║')}
${COLORS.primary('║')}         1. Open WhatsApp on your phone                                       ${COLORS.primary('║')}
${COLORS.primary('║')}         2. Go to ${COLORS.text('Settings → Linked Devices → Link a Device')}                 ${COLORS.primary('║')}
${COLORS.primary('║')}         3. Select "${COLORS.text('Link with phone number instead')}"                           ${COLORS.primary('║')}
${COLORS.primary('║')}         4. Enter the code shown above                                        ${COLORS.primary('║')}
${COLORS.primary('║')}                                                                              ${COLORS.primary('║')}
${COLORS.primary('╠══════════════════════════════════════════════════════════════════════════════╣')}
${COLORS.primary('║')}                                                                              ${COLORS.primary('║')}
${COLORS.primary('║')}       ${COLORS.muted('Press')} ${COLORS.accent('ENTER')} ${COLORS.muted('when done  |  Press')} ${COLORS.accent('R')} ${COLORS.muted('to refresh code')}                   ${COLORS.primary('║')}
${COLORS.primary('║')}                                                                              ${COLORS.primary('║')}
${COLORS.primary('╚══════════════════════════════════════════════════════════════════════════════╝')}
`;

    console.log(display);
    
    // Set up interactive input handling
    this.setupInteractiveInput();
  }

  /**
   * Show a compact pairing code (for inline display)
   */
  showCompactPairingCode(code, countdown) {
    const formattedCode = code.split('').join(' ');
    
    console.log('');
    console.log(COLORS.primary('  ╭──────────────────────────────────────────────────╮'));
    console.log(COLORS.primary('  │') + `  ${ICONS.key} ${COLORS.accentBold('Pairing Code:')} ${COLORS.codeHighlight(`  ${formattedCode}  `)}  ` + COLORS.primary('│'));
    console.log(COLORS.primary('  │') + `  ${ICONS.timer} Expires: ${COLORS.warning(countdown)}                              ` + COLORS.primary('│'));
    console.log(COLORS.primary('  ╰──────────────────────────────────────────────────╯'));
    console.log('');
  }

  /**
   * Update the countdown display
   */
  updateCountdownDisplay(countdown) {
    if (!this.currentDisplay) return;
    
    this.currentDisplay.countdown = countdown;
    
    // Only re-render if terminal supports it
    if (process.stdout.isTTY) {
      // Move cursor up and update just the countdown line
      // For simplicity, we'll just show a compact update
      process.stdout.write(`\r${ICONS.timer}  Expires in: ${COLORS.warning(countdown)}    `);
    }
  }

  /**
   * Show code expired message
   */
  showCodeExpiredMessage() {
    this.clearCurrentDisplay();
    
    console.log('');
    console.log(COLORS.warning('  ╭────────────────────────────────────────────────────╮'));
    console.log(COLORS.warning('  │') + `  ${ICONS.warning} ${COLORS.warningBold('PAIRING CODE EXPIRED')}                       ` + COLORS.warning('│'));
    console.log(COLORS.warning('  │') + `                                                    ` + COLORS.warning('│'));
    console.log(COLORS.warning('  │') + `  ${COLORS.text('Generating a new code automatically...')}          ` + COLORS.warning('│'));
    console.log(COLORS.warning('  ╰────────────────────────────────────────────────────╯'));
    console.log('');
  }

  /**
   * Show pairing success message
   */
  showPairingSuccess() {
    this.clearCurrentDisplay();
    
    console.log('');
    console.log(COLORS.success('  ╭────────────────────────────────────────────────────╮'));
    console.log(COLORS.success('  │') + `                                                    ` + COLORS.success('│'));
    console.log(COLORS.success('  │') + `       ${COLORS.successBold('✓ WHATSAPP PAIRED SUCCESSFULLY!')}             ` + COLORS.success('│'));
    console.log(COLORS.success('  │') + `                                                    ` + COLORS.success('│'));
    console.log(COLORS.success('  │') + `  ${COLORS.text('Your bot is now connected and ready to protect')}   ` + COLORS.success('│'));
    console.log(COLORS.success('  │') + `  ${COLORS.text('your WhatsApp groups from malicious links.')}       ` + COLORS.success('│'));
    console.log(COLORS.success('  │') + `                                                    ` + COLORS.success('│'));
    console.log(COLORS.success('  ╰────────────────────────────────────────────────────╯'));
    console.log('');
  }

  /**
   * Show pairing error message
   */
  showPairingError(errorMessage) {
    this.clearCurrentDisplay();
    
    console.log('');
    console.log(COLORS.error('  ╭────────────────────────────────────────────────────╮'));
    console.log(COLORS.error('  │') + `  ${COLORS.error.bold('✗ PAIRING FAILED')}                                ` + COLORS.error('│'));
    console.log(COLORS.error('  │') + `                                                    ` + COLORS.error('│'));
    console.log(COLORS.error('  │') + `  ${COLORS.text(truncateMessage(errorMessage, 42))}` + COLORS.error('│'));
    console.log(COLORS.error('  │') + `                                                    ` + COLORS.error('│'));
    console.log(COLORS.error('  │') + `  ${COLORS.muted('Try: npx whatsapp-bot-scanner pair')}               ` + COLORS.error('│'));
    console.log(COLORS.error('  ╰────────────────────────────────────────────────────╯'));
    console.log('');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Audio Notifications
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Play an alert sound (cross-platform)
   */
  playAlertSound() {
    try {
      if (process.platform === 'darwin') {
        // macOS - use afplay with a pleasant sound
        execa('afplay', ['/System/Library/Sounds/Glass.aiff'], { 
          stdio: 'ignore',
          reject: false 
        });
      } else if (process.platform === 'linux') {
        // Linux - try paplay first (PulseAudio), fallback to terminal bell
        execa('paplay', ['/usr/share/sounds/freedesktop/stereo/complete.oga'], {
          stdio: 'ignore',
          reject: false
        }).catch(() => {
          // Fallback to terminal bell
          process.stdout.write('\x07');
        });
      } else if (process.platform === 'win32') {
        // Windows - use PowerShell
        execa('powershell', ['-c', '[Console]::Beep(800, 200)'], {
          stdio: 'ignore',
          reject: false
        });
      } else {
        // Fallback to terminal bell
        process.stdout.write('\x07');
      }
    } catch {
      // Silently ignore audio errors
    }
  }

  /**
   * Text-to-speech notification (macOS/Linux)
   */
  speak(text) {
    if (!this.audioEnabled) return;
    
    try {
      if (process.platform === 'darwin') {
        execa('say', ['-v', 'Samantha', '-r', '180', text], {
          stdio: 'ignore',
          reject: false
        });
      } else if (process.platform === 'linux') {
        execa('espeak', ['-s', '150', text], {
          stdio: 'ignore',
          reject: false
        });
      }
    } catch {
      // Silently ignore speech errors
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Interactive Input Handling
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Set up readline for interactive input
   */
  setupInteractiveInput() {
    if (this.rl) return;  // Already set up
    
    if (!process.stdin.isTTY) {
      // Non-interactive mode, skip
      return;
    }

    try {
      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      this.rl.on('line', (input) => {
        const normalizedInput = input.trim().toLowerCase();
        
        if (normalizedInput === 'r') {
          console.log(`\n${ICONS.refresh}  ${COLORS.text('Refreshing pairing code...')}`);
          if (typeof this.currentDisplay?.onRefresh === 'function') {
            this.currentDisplay.onRefresh();
          }
        } else if (normalizedInput === '') {
          console.log(`\n${ICONS.check}  ${COLORS.success('Pairing process acknowledged')}`);
          if (typeof this.currentDisplay?.onComplete === 'function') {
            this.currentDisplay.onComplete();
          }
          this.cleanupInteractiveInput();
        }
      });

      this.rl.on('SIGINT', () => {
        console.log(`\n${COLORS.warning('Pairing cancelled.')}`);
        this.cleanupInteractiveInput();
        process.exit(0);
      });

      this.rl.on('error', () => {
        this.cleanupInteractiveInput();
      });

    } catch (error) {
      // Non-fatal, just skip interactive input
      this.ui?.error?.(`Could not set up interactive input: ${error.message}`);
    }
  }

  /**
   * Clean up readline interface
   */
  cleanupInteractiveInput() {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
    this.currentDisplay = null;
  }

  /**
   * Clear the current display
   */
  clearCurrentDisplay() {
    if (process.stdout.isTTY) {
      console.clear();
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Utility Methods
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Enable/disable audio notifications
   */
  setAudioEnabled(enabled) {
    this.audioEnabled = enabled;
  }

  /**
   * Check if there's an active pairing display
   */
  hasPairingDisplay() {
    return this.currentDisplay !== null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mask phone number for privacy (show last 4 digits)
 */
function maskPhone(phone) {
  if (!phone) return 'Unknown';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 4) return phone;
  const visible = cleaned.slice(-4);
  const masked = '*'.repeat(cleaned.length - 4);
  return `+${masked}${visible}`;
}

/**
 * Truncate message to fit in box
 */
function truncateMessage(message, maxLen) {
  if (!message) return ' '.repeat(maxLen);
  if (message.length <= maxLen) return message.padEnd(maxLen);
  return message.substring(0, maxLen - 3) + '...';
}

export default NotificationManager;