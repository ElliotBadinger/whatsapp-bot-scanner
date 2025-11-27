import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import EventEmitter from "node:events";

export const MODES = {
  GUIDED: "guided",
  EXPERT: "expert",
};

const VALID_MODES = new Set(Object.values(MODES));

export class ModeManager extends EventEmitter {
  #preferencePath;
  #mode = MODES.GUIDED;
  #initialized = false;
  #history = [];

  constructor(preferencePath) {
    super();
    this.#preferencePath = preferencePath;
  }

  async init() {
    if (this.#initialized) return;
    let source = "default";
    try {
      const raw = await fs.readFile(this.#preferencePath, "utf8");
      const value = raw.trim().toLowerCase();
      if (VALID_MODES.has(value)) {
        this.#mode = value;
        source = "preference";
      }
    } catch (error) {
      if (error && error.code !== "ENOENT") {
        this.emit("error", error);
      }
    }
    this.#initialized = true;
    this.#history.push({
      mode: this.#mode,
      source,
      at: new Date().toISOString(),
    });
  }

  getMode() {
    return this.#mode;
  }

  getPreferencePath() {
    return this.#preferencePath;
  }

  async setMode(nextMode, source = "system") {
    const normalized =
      typeof nextMode === "string" ? nextMode.trim().toLowerCase() : "";
    if (!VALID_MODES.has(normalized)) {
      throw new Error(`Unknown setup mode: ${nextMode}`);
    }
    if (!this.#initialized) {
      await this.init();
    }
    if (normalized === this.#mode) {
      this.#history.push({
        mode: this.#mode,
        source,
        at: new Date().toISOString(),
        unchanged: true,
      });
      return this.#mode;
    }
    const previous = this.#mode;
    this.#mode = normalized;
    await this.#persist();
    const change = {
      from: previous,
      mode: this.#mode,
      source,
      at: new Date().toISOString(),
    };
    this.#history.push(change);
    this.emit("change", change);
    return this.#mode;
  }

  async toggle(source = "system") {
    const next = this.#mode === MODES.GUIDED ? MODES.EXPERT : MODES.GUIDED;
    return this.setMode(next, source);
  }

  getHistory() {
    return [...this.#history];
  }

  async #persist() {
    try {
      await fs.writeFile(this.#preferencePath, `${this.#mode}\n`, "utf8");
    } catch (error) {
      this.emit("error", error);
    }
  }
}

export function createDefaultModeManager() {
  return new ModeManager(path.join(os.homedir(), ".wbscanner-setup-mode"));
}
