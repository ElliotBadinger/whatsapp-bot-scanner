import fs from "node:fs/promises";
import path from "node:path";
import { UserInterface } from "../ui/prompts.mjs";
import { validateApiKey } from "../utils/validation.mjs";
import {
  ConfigurationError,
  ValidationError,
  GlobalErrorHandler,
  ERROR_SEVERITY,
} from "./errors.mjs";

export class ConfigurationManager {
  constructor(rootDir, ui) {
    this.rootDir = rootDir;
    this.ui = ui;
    this.envPath = path.join(rootDir, ".env");
    this.templatePath = path.join(rootDir, ".env.hobby");
    this.currentConfig = {};
  }

  async loadOrCreateConfig() {
    try {
      await fs.access(this.envPath);
      return await this.loadExistingConfig();
    } catch {
      return await this.createFromTemplate();
    }
  }

  async loadExistingConfig() {
    this.ui.progress("Loading existing configuration...");
    const configContent = await fs.readFile(this.envPath, "utf8");
    const config = this.parseConfig(configContent);
    this.currentConfig = config;
    this.ui.success("Configuration loaded");
    return config;
  }

  async createFromTemplate() {
    this.ui.progress("Creating configuration from template...");
    await fs.copyFile(this.templatePath, this.envPath);

    // Collect API keys
    const apiKeys = await this.collectApiKeys();
    await this.updateConfig(apiKeys);

    this.currentConfig = {
      ...this.currentConfig,
      ...apiKeys,
    };

    this.ui.success("Configuration created");
    return this.currentConfig;
  }

  async collectApiKeys() {
    const keys = {};

    // VirusTotal (required)
    keys.VT_API_KEY = await this.ui.prompt({
      message: "Enter VirusTotal API Key:",
      validate: validateApiKey,
      required: true,
    });

    // Optional keys
    keys.GSB_API_KEY = await this.ui.prompt({
      message: "Enter Google Safe Browsing API Key (optional):",
      required: false,
    });

    return keys;
  }

  async updateConfig(apiKeys) {
    let configContent = await fs.readFile(this.envPath, "utf8");

    // Update each API key
    for (const [key, value] of Object.entries(apiKeys)) {
      if (value) {
        const regex = new RegExp(`^${key}=.*`, "m");
        if (regex.test(configContent)) {
          configContent = configContent.replace(regex, `${key}=${value}`);
        } else {
          configContent += `\n${key}=${value}\n`;
        }
      }
    }

    await fs.writeFile(this.envPath, configContent);
    this.currentConfig = this.parseConfig(configContent);
  }

  parseConfig(configContent) {
    const config = {};
    const lines = configContent.split("\n");

    for (const line of lines) {
      if (line.trim() && !line.startsWith("#")) {
        const [key, value] = line.split("=");
        if (key && value !== undefined) {
          config[key.trim()] = value.trim();
        }
      }
    }

    return config;
  }

  getConfig() {
    return this.currentConfig;
  }
}
