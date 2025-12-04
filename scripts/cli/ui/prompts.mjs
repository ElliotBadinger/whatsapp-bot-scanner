/**
 * Enhanced User Interface for Terminal Interactions
 * Clean, consistent, and visually appealing prompts
 */

import enquirer from "enquirer";
import chalk from "chalk";

// ─────────────────────────────────────────────────────────────────────────────
// Color Palette (matches theme.mjs)
// ─────────────────────────────────────────────────────────────────────────────

const COLORS = {
  primary: chalk.hex("#00D9FF"),
  primaryBold: chalk.hex("#00D9FF").bold,
  accent: chalk.hex("#FFB347"),
  accentBold: chalk.hex("#FFB347").bold,
  success: chalk.hex("#00E676"),
  warning: chalk.hex("#FFD54F"),
  error: chalk.hex("#FF5252"),
  muted: chalk.hex("#6B7280"),
  text: chalk.white,
  textBold: chalk.white.bold,
  code: chalk.hex("#A78BFA"),
  link: chalk.hex("#60A5FA").underline,
};

const ICONS = {
  success: COLORS.success("✓"),
  error: COLORS.error("✗"),
  warning: COLORS.warning("⚠"),
  info: COLORS.primary("ℹ"),
  arrow: COLORS.primary("→"),
  chevron: COLORS.muted("›"),
  bullet: COLORS.muted("•"),
};

// ─────────────────────────────────────────────────────────────────────────────
// User Interface Class
// ─────────────────────────────────────────────────────────────────────────────

export class UserInterface {
  constructor(interactive = true) {
    this.interactive = interactive;
    this.indentLevel = 0;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Indentation Control
  // ───────────────────────────────────────────────────────────────────────────

  indent() {
    this.indentLevel++;
    return this;
  }

  outdent() {
    this.indentLevel = Math.max(0, this.indentLevel - 1);
    return this;
  }

  resetIndent() {
    this.indentLevel = 0;
    return this;
  }

  getIndent() {
    return "  ".repeat(this.indentLevel);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Prompts
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Text input prompt
   */
  async prompt(options) {
    if (!this.interactive) {
      return options.initialValue || "";
    }

    try {
      const response = await enquirer.prompt({
        type: options.type || "input",
        name: "value",
        message: COLORS.text(options.message),
        initial: options.initialValue,
        validate: options.validate,
        required: options.required,
        format: options.format,
        result: options.result,
        // Style customization
        styles: {
          primary: COLORS.primary,
          success: COLORS.success,
          danger: COLORS.error,
          warning: COLORS.warning,
          muted: COLORS.muted,
        },
      });

      return response.value;
    } catch (error) {
      if (error.message === "canceled" || error.message === "cancelled") {
        process.exit(0);
      }
      throw error;
    }
  }

  /**
   * Password input (masked)
   */
  async password(options) {
    if (!this.interactive) {
      return options.initial || "";
    }

    try {
      const response = await enquirer.prompt({
        type: "password",
        name: "value",
        message: COLORS.text(options.message),
        validate: options.validate,
        mask: COLORS.muted("•"),
      });

      return response.value;
    } catch (error) {
      if (error.message === "canceled" || error.message === "cancelled") {
        process.exit(0);
      }
      throw error;
    }
  }

  /**
   * Confirmation prompt
   */
  async confirm(options) {
    if (!this.interactive) {
      return options.initial ?? false;
    }

    try {
      const response = await enquirer.prompt({
        type: "confirm",
        name: "value",
        message: COLORS.text(options.message),
        initial: options.initial,
      });

      return response.value;
    } catch (error) {
      if (error.message === "canceled" || error.message === "cancelled") {
        process.exit(0);
      }
      throw error;
    }
  }

  /**
   * Select from list
   */
  async select(options) {
    if (!this.interactive) {
      return options.initial || options.choices[0]?.value;
    }

    try {
      // Format choices with icons
      const formattedChoices = options.choices.map((choice) => {
        if (typeof choice === "string") {
          return { name: choice, message: choice, value: choice };
        }
        return {
          name: choice.value || choice.name,
          message: choice.message || choice.name,
          value: choice.value || choice.name,
          hint: choice.hint ? COLORS.muted(choice.hint) : undefined,
        };
      });

      const response = await enquirer.prompt({
        type: "select",
        name: "value",
        message: COLORS.text(options.message),
        choices: formattedChoices,
        initial: options.initial,
        pointer: COLORS.accent("›"),
        indicator: COLORS.success("●"),
      });

      return response.value;
    } catch (error) {
      if (error.message === "canceled" || error.message === "cancelled") {
        process.exit(0);
      }
      throw error;
    }
  }

  /**
   * Multi-select from list
   */
  async multiSelect(options) {
    if (!this.interactive) {
      return options.initial || [];
    }

    try {
      const formattedChoices = options.choices.map((choice) => ({
        name: choice.value || choice.name,
        message: choice.message || choice.name,
        value: choice.value || choice.name,
        enabled: choice.enabled ?? false,
      }));

      const response = await enquirer.prompt({
        type: "multiselect",
        name: "value",
        message: COLORS.text(options.message),
        choices: formattedChoices,
        hint: options.hint
          ? COLORS.muted(options.hint)
          : COLORS.muted("Space to toggle, Enter to confirm"),
        pointer: COLORS.accent("›"),
        indicator: COLORS.success("●"),
      });

      return response.value;
    } catch (error) {
      if (error.message === "canceled" || error.message === "cancelled") {
        process.exit(0);
      }
      throw error;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Output Messages
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Information message
   */
  info(message) {
    console.log(`${this.getIndent()}${ICONS.info}  ${COLORS.text(message)}`);
    return this;
  }

  /**
   * Success message
   */
  success(message) {
    console.log(
      `${this.getIndent()}${ICONS.success}  ${COLORS.success(message)}`,
    );
    return this;
  }

  /**
   * Warning message
   */
  warn(message) {
    console.log(
      `${this.getIndent()}${ICONS.warning}  ${COLORS.warning(message)}`,
    );
    return this;
  }

  /**
   * Error message
   */
  error(message) {
    console.log(`${this.getIndent()}${ICONS.error}  ${COLORS.error(message)}`);
    return this;
  }

  /**
   * Step/action message
   */
  step(message) {
    console.log(`${this.getIndent()}${ICONS.arrow}  ${COLORS.text(message)}`);
    return this;
  }

  /**
   * Hint/detail message (muted)
   */
  hint(message) {
    console.log(
      `${this.getIndent()}   ${COLORS.muted(ICONS.chevron + " " + message)}`,
    );
    return this;
  }

  /**
   * Plain log
   */
  log(message = "") {
    console.log(`${this.getIndent()}${message}`);
    return this;
  }

  /**
   * Emphasized text
   */
  bold(message) {
    console.log(`${this.getIndent()}${COLORS.textBold(message)}`);
    return this;
  }

  /**
   * Muted/dim text
   */
  dim(message) {
    console.log(`${this.getIndent()}${COLORS.muted(message)}`);
    return this;
  }

  /**
   * Code/command display
   */
  code(command) {
    console.log(`${this.getIndent()}   ${COLORS.code("$ " + command)}`);
    return this;
  }

  /**
   * Link display
   */
  link(url, label = null) {
    const display = label ? `${label}: ${COLORS.link(url)}` : COLORS.link(url);
    console.log(`${this.getIndent()}${display}`);
    return this;
  }

  /**
   * Progress indicator (static)
   */
  progress(message) {
    console.log(
      `${this.getIndent()}${COLORS.accent("⟳")}  ${COLORS.text(message)}`,
    );
    return this;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Structural Elements
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Empty line
   */
  newline(count = 1) {
    for (let i = 0; i < count; i++) {
      console.log("");
    }
    return this;
  }

  /**
   * Horizontal divider
   */
  divider(char = "─", width = 50) {
    console.log(`${this.getIndent()}${COLORS.muted(char.repeat(width))}`);
    return this;
  }

  /**
   * Section header
   */
  section(title, options = {}) {
    const { icon = null, step = null, total = null } = options;

    console.log("");
    console.log(`${this.getIndent()}${COLORS.muted("─".repeat(50))}`);

    let header = "";
    if (step && total) {
      header += COLORS.accent(`Step ${step}/${total}: `);
    }
    if (icon) {
      header += icon + " ";
    }
    header += COLORS.textBold(title);

    console.log(`${this.getIndent()}${header}`);
    console.log(`${this.getIndent()}${COLORS.muted("─".repeat(50))}`);

    return this;
  }

  /**
   * Key-value display
   */
  keyValue(key, value, options = {}) {
    const { keyWidth = 20, separator = ":" } = options;
    const paddedKey = key.padEnd(keyWidth);
    console.log(
      `${this.getIndent()}${COLORS.muted(paddedKey)}${COLORS.muted(separator)} ${COLORS.text(value)}`,
    );
    return this;
  }

  /**
   * Bullet list item
   */
  bullet(message) {
    console.log(`${this.getIndent()}${ICONS.bullet} ${COLORS.text(message)}`);
    return this;
  }

  /**
   * Numbered list item
   */
  numbered(index, message) {
    const num = COLORS.muted(`${index}.`);
    console.log(`${this.getIndent()}${num} ${COLORS.text(message)}`);
    return this;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Complex Components
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Display a box with content
   */
  box(content, options = {}) {
    const {
      title = null,
      style = "rounded",
      borderColor = COLORS.primary,
    } = options;

    const lines = Array.isArray(content) ? content : content.split("\n");
    const maxWidth = Math.max(...lines.map((l) => stripAnsi(l).length));
    const innerWidth = Math.max(maxWidth + 2, 40);

    const chars =
      style === "double"
        ? { tl: "╔", tr: "╗", bl: "╚", br: "╝", h: "═", v: "║" }
        : { tl: "╭", tr: "╮", bl: "╰", br: "╯", h: "─", v: "│" };

    // Top border with optional title
    let topBorder = borderColor(
      chars.tl + chars.h.repeat(innerWidth) + chars.tr,
    );
    if (title) {
      const titleText = ` ${title} `;
      const titleStart = Math.floor((innerWidth - titleText.length) / 2);
      topBorder =
        borderColor(chars.tl + chars.h.repeat(titleStart)) +
        COLORS.textBold(titleText) +
        borderColor(
          chars.h.repeat(innerWidth - titleStart - titleText.length) + chars.tr,
        );
    }

    console.log(`${this.getIndent()}${topBorder}`);

    // Content
    for (const line of lines) {
      const strippedLen = stripAnsi(line).length;
      const padding = " ".repeat(Math.max(0, innerWidth - strippedLen - 1));
      console.log(
        `${this.getIndent()}${borderColor(chars.v)} ${line}${padding}${borderColor(chars.v)}`,
      );
    }

    // Bottom border
    console.log(
      `${this.getIndent()}${borderColor(chars.bl + chars.h.repeat(innerWidth) + chars.br)}`,
    );

    return this;
  }

  /**
   * Display a table
   */
  table(headers, rows, options = {}) {
    const { columnWidths = null } = options;

    // Calculate column widths
    const widths =
      columnWidths ||
      headers.map((h, i) => {
        const headerLen = stripAnsi(h).length;
        const maxRowLen = Math.max(
          ...rows.map((r) => stripAnsi(String(r[i] || "")).length),
        );
        return Math.max(headerLen, maxRowLen) + 2;
      });

    // Header
    const headerRow = headers
      .map((h, i) => padText(COLORS.textBold(h), widths[i]))
      .join(COLORS.muted(" │ "));
    console.log(`${this.getIndent()}${headerRow}`);

    // Separator
    const separator = widths.map((w) => "─".repeat(w)).join("─┼─");
    console.log(`${this.getIndent()}${COLORS.muted(separator)}`);

    // Rows
    for (const row of rows) {
      const rowText = row
        .map((cell, i) => padText(String(cell || ""), widths[i]))
        .join(COLORS.muted(" │ "));
      console.log(`${this.getIndent()}${rowText}`);
    }

    return this;
  }

  /**
   * Clear the screen
   */
  clear() {
    console.clear();
    return this;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strip ANSI codes for length calculation
 */
function stripAnsi(str) {
  return String(str).replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * Pad text to width
 */
function padText(text, width, align = "left") {
  const stripped = stripAnsi(text);
  const diff = width - stripped.length;
  if (diff <= 0) return text;

  if (align === "center") {
    const left = Math.floor(diff / 2);
    return " ".repeat(left) + text + " ".repeat(diff - left);
  } else if (align === "right") {
    return " ".repeat(diff) + text;
  }
  return text + " ".repeat(diff);
}

export default UserInterface;
