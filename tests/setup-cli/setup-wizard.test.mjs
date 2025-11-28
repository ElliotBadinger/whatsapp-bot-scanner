import { describe, it, expect, beforeEach, vi } from "vitest";
import os from "node:os";
import fs from "node:fs/promises";
import path from "node:path";

import { SetupContext } from "../../scripts/setup/core/context.mjs";
import { parseFlags } from "../../scripts/setup/core/flags.mjs";
import { registerBuiltinPlugins } from "../../scripts/setup/plugins/builtin.mjs";
import {
  pluginsForStage,
  clearPlugins,
} from "../../scripts/setup/plugins/registry.mjs";

class MemoryEnv {
  constructor(initial = {}) {
    this.store = new Map(Object.entries(initial));
  }

  get(key) {
    return this.store.get(key) ?? "";
  }

  set(key, value) {
    this.store.set(key, value);
  }
}

async function createTempRoot() {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "setup-wizard-test-"));
  return base;
}

describe("SetupContext preferences & mode persistence", () => {
  let root;

  beforeEach(async () => {
    root = await createTempRoot();
  });

  it("persists expert mode preference across runs", async () => {
    const context = new SetupContext(root);
    await context.initialize();
    expect(context.mode).toBe("guided");
    context.toggleMode({ reason: "test" });
    expect(context.mode).toBe("expert");
    context.log("message", { level: "info", message: "Switching modes" });
    await context.finalize("success");

    const next = new SetupContext(root);
    await next.initialize();
    expect(next.mode).toBe("expert");
  });
});

describe("Transcript artifacts", () => {
  let root;

  beforeEach(async () => {
    root = await createTempRoot();
  });

  it("writes markdown and JSON with redacted secrets", async () => {
    const context = new SetupContext(root);
    await context.initialize();
    context.log("message", { level: "info", secretToken: "abcdef0123456789" });
    const { jsonPath, transcriptPath } = await context.finalize("success");
    const json = JSON.parse(await fs.readFile(jsonPath, "utf8"));
    const transcript = await fs.readFile(transcriptPath, "utf8");

    expect(json.status).toBe("success");
    expect(JSON.stringify(json)).not.toContain("abcdef0123456789");
    expect(transcript).not.toContain("abcdef0123456789");
    expect(json.events.length).toBeGreaterThan(0);
  });
});

describe("Finalize warnings", () => {
  it("continues when preferences cache is not writable", async () => {
    const root = await createTempRoot();
    const context = new SetupContext(root);
    await context.initialize();
    const originalWriteFile = fs.writeFile;
    const spy = vi
      .spyOn(fs, "writeFile")
      .mockImplementation(async (file, ...args) => {
        if (String(file).includes("preferences.json")) {
          const error = new Error("EACCES: permission denied");
          error.code = "EACCES";
          throw error;
        }
        return originalWriteFile(file, ...args);
      });
    const result = await context.finalize("success");
    spy.mockRestore();
    expect(result.warnings.some((w) => w.type === "preferences")).toBe(true);
  });
});

describe("Plugin registration", () => {
  let context;

  beforeEach(async () => {
    const root = await createTempRoot();
    context = new SetupContext(root);
    await context.initialize();
    context.flags = parseFlags([]);
    clearPlugins();
    registerBuiltinPlugins();
  });

  it("skips optional plugins in noninteractive mode", () => {
    context.flags.noninteractive = true;
    const stagePlugins = pluginsForStage("environment", context);
    expect(stagePlugins.length).toBe(0);
  });

  it("configures urlscan plugin when enabled", async () => {
    context.flags.noninteractive = false;
    const stagePlugins = pluginsForStage("environment", context);
    const plugin = stagePlugins.find((p) => p.id === "urlscan-integration");
    expect(plugin).toBeDefined();

    const envFile = new MemoryEnv({ URLSCAN_ENABLED: "false" });
    const output = {
      info: () => {},
      note: () => {},
      heading: () => {},
    };
    const runtime = {
      envFile,
      generateHexSecret: () => "secret-hex-value",
    };
    const prompt = {
      confirm: async () => true,
      input: async () => "ABCDEFGHIJKLMNOPQRSTUVWX123456",
    };

    await plugin.run({ context, runtime, output, prompt });
    expect(envFile.get("URLSCAN_ENABLED")).toBe("true");
    expect(envFile.get("URLSCAN_API_KEY")).toBe(
      "ABCDEFGHIJKLMNOPQRSTUVWX123456",
    );
    expect(envFile.get("URLSCAN_CALLBACK_SECRET")).toBe("secret-hex-value");
  });
});
