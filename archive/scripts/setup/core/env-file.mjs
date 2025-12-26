import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function parseLine(line) {
  const match = line.match(/^([^#=\s][^=]*)=(.*)$/);
  if (!match) {
    if (line.trim() === "") return { type: "blank", raw: line };
    return { type: "comment", raw: line };
  }
  return { type: "pair", key: match[1], value: match[2] };
}

export class EnvFile {
  constructor(filePath, templatePath) {
    this.filePath = filePath;
    this.templatePath = templatePath;
    this.entries = [];
    this.loaded = false;
  }

  async ensure() {
    try {
      await fs.access(this.filePath);
    } catch (err) {
      if (err.code === "ENOENT") {
        if (!this.templatePath) throw new Error(".env template missing");
        await fs.copyFile(this.templatePath, this.filePath);
      } else {
        throw err;
      }
    }
    await this.reload();
  }

  async reload() {
    const contents = await fs.readFile(this.filePath, "utf8");
    this.entries = contents.split(/\r?\n/).map(parseLine);
    this.loaded = true;
  }

  get(key) {
    this.assertLoaded();
    const entry = this.entries.find((e) => e.type === "pair" && e.key === key);
    return entry?.value ?? "";
  }

  set(key, value) {
    this.assertLoaded();
    let found = false;
    this.entries = this.entries.filter((e) => {
      if (e.type === "pair" && e.key === key) {
        if (!found) {
          e.value = value;
          found = true;
          return true;
        }
        return false;
      }
      return true;
    });

    if (!found) {
      if (this.entries.length && this.entries.at(-1).type !== "blank") {
        this.entries.push({ type: "blank", raw: "" });
      }
      this.entries.push({ type: "pair", key, value });
    }
  }

  ensureBlankLine() {
    if (this.entries.length && this.entries.at(-1).type !== "blank") {
      this.entries.push({ type: "blank", raw: "" });
    }
  }

  assertLoaded() {
    if (!this.loaded) throw new Error("Environment file not loaded");
  }

  async save() {
    this.assertLoaded();
    const lines = this.entries.map((entry) => {
      if (entry.type === "pair") return `${entry.key}=${entry.value}`;
      return entry.raw ?? "";
    });
    await fs.writeFile(this.filePath, lines.join(os.EOL), "utf8");
  }
}
