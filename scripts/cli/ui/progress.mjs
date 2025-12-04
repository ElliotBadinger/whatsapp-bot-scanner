import ora from "ora";

export class ProgressManager {
  constructor() {
    this.spinners = new Map();
  }

  start(task, message) {
    if (this.spinners.has(task)) {
      this.spinners.get(task).text = message;
      return;
    }

    const spinner = ora({
      text: message,
      color: "cyan",
      spinner: "dots",
    }).start();

    this.spinners.set(task, spinner);
  }

  succeed(task, message) {
    const spinner = this.spinners.get(task);
    if (spinner) {
      spinner.succeed(message);
      this.spinners.delete(task);
    }
  }

  fail(task, message) {
    const spinner = this.spinners.get(task);
    if (spinner) {
      spinner.fail(message);
      this.spinners.delete(task);
    }
  }

  stop(task) {
    const spinner = this.spinners.get(task);
    if (spinner) {
      spinner.stop();
      this.spinners.delete(task);
    }
  }

  stopAll() {
    for (const [task, spinner] of this.spinners) {
      spinner.stop();
    }
    this.spinners.clear();
  }
}
