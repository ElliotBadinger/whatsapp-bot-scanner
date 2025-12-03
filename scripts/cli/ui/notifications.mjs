import { execa } from 'execa';
import { UserInterface } from './prompts.mjs';
import boxen from 'boxen';
import chalk from 'chalk';
import readline from 'node:readline';

export class NotificationManager {
  constructor(ui) {
    this.ui = ui;
    this.currentDisplay = null;
    this.rl = null;
    this.inputHandlers = { onRefresh: null, onComplete: null };
  }

  triggerPairingAlert(code, phone, countdown = '02:00', callbacks = {}) {
    // Audio alert
    this.playAlertSound();

    // Voice notification (if available)
    if (process.platform === 'darwin') {
      this.speak(`WhatsApp pairing code ${code} received`);
    }

    // Show visual pairing display
    this.showVisualPairingDisplay(code, phone, countdown, callbacks);
  }

  playAlertSound() {
    // Cross-platform alert sound
    try {
      if (process.platform === 'darwin') {
        execa('afplay', ['/System/Library/Sounds/Ping.aiff']);
      } else {
        // Fallback to terminal bell
        process.stdout.write('\x07');
      }
    } catch {
      // Ignore sound errors
    }
  }

  speak(text) {
    try {
      if (process.platform === 'darwin') {
        execa('say', ['-v', 'Ava', text]);
      } else if (process.platform === 'linux') {
        execa('espeak', [text]);
      }
    } catch {
      // Ignore speech errors
    }
  }

  showVisualPairingDisplay(code, phone, countdown, callbacks = {}) {
    try {
      this.currentDisplay = {
        code,
        phone,
        countdown,
        onRefresh: callbacks.onRefresh,
        onComplete: callbacks.onComplete
      };

      this.renderPairingBox();
      this.setupInteractiveInput();

    } catch (error) {
      console.error('Error displaying pairing interface:', error.message);
      this.ui.error('Failed to display pairing interface. Falling back to basic display.');
      this.showBasicPairingDisplay(code, phone, countdown);
    }
  }

  renderPairingBox() {
    if (!this.currentDisplay) return;

    const { code, phone, countdown } = this.currentDisplay;

    // Clear any existing display (keeps readline instance intact)
    this.clearCurrentDisplay();

    const pairingBox = boxen(
      chalk.bold.green('🔑 WHATSAPP PAIRING REQUIRED') + '\n\n' +
      chalk.bold(`Code: ${chalk.yellow(code)}`) + '\n' +
      chalk.bold(`Phone: ${chalk.cyan(phone)}`) + '\n\n' +
      chalk.bold(`Expires in: ${chalk.red(countdown)}`) + '\n\n' +
      chalk.dim('Press ENTER when pairing is complete') + '\n' +
      chalk.dim('Press R to refresh the pairing code'),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'blue',
        backgroundColor: '#000000',
        align: 'center'
      }
    );

    console.log(pairingBox);
  }

  showBasicPairingDisplay(code, phone, countdown) {
    this.ui.success(`🔑 WhatsApp Pairing Code: ${code}`);
    this.ui.info(`Phone: ${phone}`);
    this.ui.warn(`Expires in: ${countdown}`);
    this.ui.info('Press ENTER when pairing is complete, R to refresh');
  }

  updateCountdownDisplay(countdown) {
    if (!this.currentDisplay) return;
    this.currentDisplay.countdown = countdown;
    this.renderPairingBox();
  }

  showCodeExpiredMessage() {
    this.clearCurrentDisplay();

    const expiredBox = boxen(
      chalk.bold.red('⏰ PAIRING CODE EXPIRED') + '\n\n' +
      chalk.bold('The pairing code has expired.') + '\n' +
      chalk.dim('A new code has been generated automatically.'),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'red',
        backgroundColor: '#000000',
        align: 'center'
      }
    );

    console.log(expiredBox);
  }

  setupInteractiveInput() {
    if (this.rl) {
      return;
    }

    try {
      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      this.rl.on('line', (input) => {
        try {
          if (input.toLowerCase() === 'r') {
            this.ui.info('🔄 Refresh requested...');
            if (typeof this.currentDisplay?.onRefresh === 'function') {
              this.currentDisplay.onRefresh();
            }
          } else if (input === '') {
            this.ui.success('✅ Pairing process completed!');
            if (typeof this.currentDisplay?.onComplete === 'function') {
              this.currentDisplay.onComplete();
            }
          }
        } catch (error) {
          console.error('Error handling user input:', error.message);
        }
      });

      this.rl.on('SIGINT', () => {
        this.cleanupInteractiveInput();
      });

      this.rl.on('error', (error) => {
        console.error('Readline error:', error.message);
        this.cleanupInteractiveInput();
      });

    } catch (error) {
      console.error('Error setting up interactive input:', error.message);
      this.ui.error('Failed to set up interactive input. Using basic interface.');
    }
  }

  cleanupInteractiveInput() {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
    this.currentDisplay = null;
  }

  clearCurrentDisplay() {
    // Clear the console without breaking readline prompts
    process.stdout.write('\x1B[2J\x1B[0f');
  }
}