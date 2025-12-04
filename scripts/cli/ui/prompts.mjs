import enquirer from "enquirer";
import chalk from "chalk";

export class UserInterface {
  constructor(interactive = true) {
    this.interactive = interactive;
  }

  async prompt(options) {
    if (!this.interactive) {
      return options.initialValue || "";
    }

    try {
      const response = await enquirer.prompt({
        type: "input",
        name: "value",
        message: options.message,
        initial: options.initialValue,
        validate: options.validate,
        required: options.required,
      });

      return response.value;
    } catch (error) {
      if (error.message === "canceled") {
        process.exit(0);
      }
      throw error;
    }
  }

  async confirm(options) {
    if (!this.interactive) {
      return options.initial || false;
    }

    const response = await enquirer.prompt({
      type: "confirm",
      name: "value",
      message: options.message,
      initial: options.initial,
      affirmative: options.affirmative || "Yes",
      negative: options.negative || "No",
    });

    return response.value;
  }

  async select(options) {
    if (!this.interactive) {
      return options.initial || options.choices[0].value;
    }

    const response = await enquirer.prompt({
      type: "select",
      name: "value",
      message: options.message,
      choices: options.choices,
      initial: options.initial,
    });

    return response.value;
  }

  info(message) {
    console.log(chalk.blue("ℹ"), message);
  }

  success(message) {
    console.log(chalk.green("✓"), message);
  }

  warn(message) {
    console.log(chalk.yellow("⚠"), message);
  }

  error(message) {
    console.log(chalk.red("✗"), message);
  }

  progress(message) {
    console.log(chalk.cyan("⏳"), message);
  }

  log(message) {
    console.log(message);
  }
}
