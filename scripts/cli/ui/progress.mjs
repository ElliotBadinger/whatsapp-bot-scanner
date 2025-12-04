/**
 * Enhanced Progress Manager
 * Beautiful, informative progress visualization for terminal
 */

import ora from 'ora';
import chalk from 'chalk';

// ─────────────────────────────────────────────────────────────────────────────
// Color Scheme (matches theme.mjs)
// ─────────────────────────────────────────────────────────────────────────────

const COLORS = {
  primary: chalk.hex('#00D9FF'),
  accent: chalk.hex('#FFB347'),
  success: chalk.hex('#00E676'),
  warning: chalk.hex('#FFD54F'),
  error: chalk.hex('#FF5252'),
  muted: chalk.hex('#6B7280'),
  text: chalk.white,
};

const ICONS = {
  success: COLORS.success('✓'),
  error: COLORS.error('✗'),
  warning: COLORS.warning('⚠'),
  info: COLORS.primary('ℹ'),
  pending: COLORS.muted('○'),
  active: COLORS.accent('◉'),
  complete: COLORS.success('●'),
};

const BOX = {
  filled: '█',
  partial: '▓',
  empty: '░',
  horizontal: '─',
};

// ─────────────────────────────────────────────────────────────────────────────
// Progress Manager Class
// ─────────────────────────────────────────────────────────────────────────────

export class ProgressManager {
  constructor() {
    this.spinners = new Map();
    this.steps = [];
    this.currentStepIndex = -1;
    this.startTimes = new Map();
    this.completedSteps = new Set();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Step Management
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Initialize steps for tracking
   */
  setSteps(steps) {
    this.steps = steps.map((s, i) => ({
      id: s.id || `step-${i}`,
      name: s.name,
      estimate: s.estimate || null,
    }));
    this.currentStepIndex = -1;
    this.completedSteps.clear();
  }

  /**
   * Begin a step
   */
  beginStep(stepId) {
    const index = this.steps.findIndex(s => s.id === stepId);
    if (index !== -1) {
      this.currentStepIndex = index;
      this.startTimes.set(stepId, Date.now());
    }
  }

  /**
   * Complete a step
   */
  completeStep(stepId) {
    this.completedSteps.add(stepId);
    const startTime = this.startTimes.get(stepId);
    const duration = startTime ? Date.now() - startTime : null;
    return duration;
  }

  /**
   * Render step progress visualization
   */
  renderSteps(options = {}) {
    const { showEstimates = true, showDurations = true } = options;
    const lines = [];
    
    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      const isComplete = this.completedSteps.has(step.id);
      const isCurrent = i === this.currentStepIndex;
      
      let icon, textStyle;
      
      if (isComplete) {
        icon = ICONS.complete;
        textStyle = COLORS.muted;
      } else if (isCurrent) {
        icon = ICONS.active;
        textStyle = COLORS.accent.bold;
      } else {
        icon = ICONS.pending;
        textStyle = COLORS.muted;
      }
      
      let line = `  ${icon}  ${textStyle(step.name)}`;
      
      // Add timing info
      if (isComplete && showDurations) {
        const startTime = this.startTimes.get(step.id);
        if (startTime) {
          const duration = Date.now() - startTime;
          line += COLORS.muted(` (${formatDuration(duration)})`);
        }
      } else if (!isComplete && showEstimates && step.estimate) {
        line += COLORS.muted(` ~${step.estimate}`);
      }
      
      lines.push(line);
      
      // Connector (except for last step)
      if (i < this.steps.length - 1) {
        const connectorColor = isComplete ? COLORS.success : COLORS.muted;
        lines.push(`  ${connectorColor('│')}`);
      }
    }
    
    return lines.join('\n');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Spinner Management
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Start a spinner for a task
   */
  start(task, message, options = {}) {
    const { 
      color = 'cyan',
      spinner = 'dots12'  // Modern, smooth spinner
    } = options;
    
    if (this.spinners.has(task)) {
      this.spinners.get(task).text = formatSpinnerText(message);
      return;
    }

    const spinnerInstance = ora({
      text: formatSpinnerText(message),
      color: color,
      spinner: spinner,
      prefixText: '',
    }).start();

    this.spinners.set(task, spinnerInstance);
    this.startTimes.set(task, Date.now());
  }

  /**
   * Update spinner text
   */
  update(task, message) {
    const spinner = this.spinners.get(task);
    if (spinner) {
      spinner.text = formatSpinnerText(message);
    }
  }

  /**
   * Mark task as successful
   */
  succeed(task, message) {
    const spinner = this.spinners.get(task);
    if (spinner) {
      const duration = this.getDuration(task);
      const durationText = duration ? COLORS.muted(` (${formatDuration(duration)})`) : '';
      spinner.stopAndPersist({
        symbol: ICONS.success,
        text: COLORS.text(message) + durationText,
      });
      this.spinners.delete(task);
    }
  }

  /**
   * Mark task as failed
   */
  fail(task, message) {
    const spinner = this.spinners.get(task);
    if (spinner) {
      spinner.stopAndPersist({
        symbol: ICONS.error,
        text: COLORS.error(message),
      });
      this.spinners.delete(task);
    }
  }

  /**
   * Mark task with warning
   */
  warn(task, message) {
    const spinner = this.spinners.get(task);
    if (spinner) {
      spinner.stopAndPersist({
        symbol: ICONS.warning,
        text: COLORS.warning(message),
      });
      this.spinners.delete(task);
    }
  }

  /**
   * Mark task as info/skipped
   */
  info(task, message) {
    const spinner = this.spinners.get(task);
    if (spinner) {
      spinner.stopAndPersist({
        symbol: ICONS.info,
        text: COLORS.muted(message),
      });
      this.spinners.delete(task);
    }
  }

  /**
   * Stop a spinner without status
   */
  stop(task) {
    const spinner = this.spinners.get(task);
    if (spinner) {
      spinner.stop();
      this.spinners.delete(task);
    }
  }

  /**
   * Stop all spinners
   */
  stopAll() {
    for (const [task, spinner] of this.spinners) {
      spinner.stop();
    }
    this.spinners.clear();
  }

  /**
   * Get duration for a task
   */
  getDuration(task) {
    const startTime = this.startTimes.get(task);
    return startTime ? Date.now() - startTime : null;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Progress Bar
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Render a progress bar
   */
  renderProgressBar(current, total, options = {}) {
    const {
      width = 30,
      showPercent = true,
      showETA = false,
      label = '',
      filled = BOX.filled,
      empty = BOX.empty,
    } = options;

    const percent = Math.min(100, Math.round((current / total) * 100));
    const filledCount = Math.round((percent / 100) * width);
    const emptyCount = width - filledCount;

    const bar = 
      COLORS.success(filled.repeat(filledCount)) + 
      COLORS.muted(empty.repeat(emptyCount));

    let result = bar;
    
    if (showPercent) {
      result += COLORS.muted(` ${percent.toString().padStart(3)}%`);
    }
    
    if (label) {
      result = COLORS.text(label + ' ') + result;
    }

    return result;
  }

  /**
   * Create inline step progress
   */
  renderInlineProgress(currentStep, totalSteps, stepName) {
    const bar = this.renderProgressBar(currentStep, totalSteps, { width: 20 });
    return `${bar} ${COLORS.muted('│')} ${COLORS.text(stepName)}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format spinner text with consistent styling
 */
function formatSpinnerText(message) {
  return COLORS.text(message);
}

/**
 * Format duration in human-readable form
 */
function formatDuration(ms) {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Calculate estimated time remaining
 */
function calculateETA(current, total, elapsedMs) {
  if (current === 0) return null;
  const rate = current / elapsedMs;
  const remaining = total - current;
  return Math.round(remaining / rate);
}

export default ProgressManager;
