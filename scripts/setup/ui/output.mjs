import chalk from "chalk";
import logSymbols from "log-symbols";

function buildTheme(context) {
  const base = context.highContrast
    ? {
        heading: chalk.bold.white,
        info: chalk.white,
        success: chalk.bold.green,
        warn: chalk.bold.yellow,
        error: chalk.bold.red,
      }
    : {
        heading: chalk.cyanBright.bold,
        info: chalk.cyan,
        success: chalk.greenBright,
        warn: chalk.yellowBright,
        error: chalk.redBright,
      };
  if (context.noColor) {
    const noop = (value) => value;
    return {
      heading: noop,
      info: noop,
      success: noop,
      warn: noop,
      error: noop,
    };
  }
  return base;
}

export function createOutput(context) {
  const theme = buildTheme(context);

  function emit(symbol, renderer, message, payload = {}) {
    const output = renderer(`${symbol ? `${symbol} ` : ""}${message}`);
    if (context.verbose) {
      console.log(output);
    } else if (symbol) {
      console.log(`${symbol} ${message}`);
    } else {
      console.log(message);
    }
    context.log("message", { level: payload.level, message, ...payload });
  }

  return {
    heading(text) {
      const formatted = context.verbose
        ? theme.heading(`\n${text}\n`)
        : theme.heading(text);
      console.log(formatted);
      context.log("heading", { text });
    },
    info(message, data) {
      emit(logSymbols.info, theme.info, message, { level: "info", ...data });
    },
    success(message, data) {
      emit(logSymbols.success, theme.success, message, {
        level: "success",
        ...data,
      });
      process.stdout.write("\u0007");
    },
    warn(message, data) {
      emit(logSymbols.warning, theme.warn, message, { level: "warn", ...data });
    },
    error(message, data) {
      emit(logSymbols.error, theme.error, message, { level: "error", ...data });
    },
    note(message) {
      if (context.verbose) {
        console.log(message);
      }
      context.log("note", { message });
    },
    divider() {
      if (!context.verbose) return;
      console.log(
        context.noColor
          ? "────────────────────────────"
          : chalk.gray("────────────────────────────"),
      );
    },
  };
}
