import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

import humanizeDuration from "humanize-duration";

const SENSITIVE_KEYWORDS = [
  "api",
  "key",
  "token",
  "secret",
  "password",
  "bearer",
  "session",
  "auth",
];
const SECRET_VALUE_REGEX = /^(?:[A-Fa-f0-9]{32,}|[A-Za-z0-9+\/_=-]{24,})$/;

function redactString() {
  return "[redacted]";
}

function shouldRedactString(value, keyPath) {
  if (!value) return false;
  const containsKeyword = Array.isArray(keyPath)
    ? keyPath.some((key) =>
        SENSITIVE_KEYWORDS.some(
          (keyword) => key && key.toLowerCase().includes(keyword),
        ),
      )
    : false;
  if (containsKeyword) {
    return true;
  }
  const trimmed = value.trim();
  if (
    trimmed.length >= 20 &&
    !/\s/.test(trimmed) &&
    SECRET_VALUE_REGEX.test(trimmed)
  ) {
    return true;
  }
  if (trimmed.startsWith("-----BEGIN") && trimmed.includes("PRIVATE")) {
    return true;
  }
  return false;
}

function scrub(value, keyPath = []) {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return shouldRedactString(value, keyPath) ? redactString() : value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      scrub(item, keyPath.concat(String(index))),
    );
  }
  if (value && typeof value === "object") {
    const output = {};
    for (const [key, nested] of Object.entries(value)) {
      output[key] = scrub(nested, keyPath.concat(key));
    }
    return output;
  }
  if (typeof value === "function") {
    return "[function]";
  }
  return value;
}

function stringifyInline(value) {
  if (value === undefined) return "`undefined`";
  if (value === null) return "`null`";
  if (typeof value === "string")
    return value.length === 0 ? "``" : `\`${value}\``;
  try {
    return `\`${JSON.stringify(value)}\``;
  } catch {
    return "`[unserializable]`";
  }
}

function summarizePromptOptions(options = {}) {
  const summary = {};
  if (options.name) summary.name = options.name;
  if (options.message) summary.message = options.message;
  if (Object.prototype.hasOwnProperty.call(options, "initial")) {
    summary.initial = options.initial;
  }
  if (Object.prototype.hasOwnProperty.call(options, "initialValue")) {
    summary.initialValue = options.initialValue;
  }
  if (Array.isArray(options.choices)) {
    summary.choices = options.choices.map((choice, index) => {
      const base = {
        name: choice?.name ?? choice?.title,
        initial: Boolean(choice?.initial),
        hint: choice?.hint,
        disabled: Boolean(choice?.disabled),
      };
      if (Object.prototype.hasOwnProperty.call(choice || {}, "value")) {
        base.value = scrub(choice.value, [options.name || `choice-${index}`]);
      }
      return scrub(base, [options.name || `choice-${index}`]);
    });
  }
  return scrub(summary, options.name ? [options.name] : []);
}

function formatEventLine(event) {
  const stamp = event.timestamp ? `**${event.timestamp}**` : "`–`";
  switch (event.type) {
    case "prompt": {
      const response = event.hasOwnProperty("response")
        ? ` → ${stringifyInline(event.response)}`
        : "";
      const scope =
        event.message || event.name ? ` ${event.message || event.name}` : "";
      const interaction =
        event.interactive === false && event.reason
          ? ` (auto: ${event.reason})`
          : event.interactive === false
            ? " (auto)"
            : "";
      return `- ${stamp} ❓ Prompt (${event.promptType})${scope}${response}${interaction}`;
    }
    case "decision": {
      return `- ${stamp} ⚙️ Decision (${event.kind}) ${event.detail ? stringifyInline(event.detail) : ""}`;
    }
    case "task-start": {
      return `- ${stamp} ▶️ Task started: ${event.title || event.id}`;
    }
    case "task-end": {
      const statusSymbol =
        event.status === "success"
          ? "✅"
          : event.status === "skip"
            ? "⏭️"
            : "❌";
      const duration =
        typeof event.durationMs === "number"
          ? ` in ${humanizeDuration(Math.max(1, Math.round(event.durationMs)), { largest: 2, round: true })}`
          : "";
      const detail = event.detail ? ` ${stringifyInline(event.detail)}` : "";
      return `- ${stamp} ${statusSymbol} Task ${event.status}: ${event.title || event.id}${duration}${detail}`;
    }
    case "message": {
      return `- ${stamp} 📝 ${event.level?.toUpperCase() || "INFO"} ${event.text || ""}`;
    }
    case "lifecycle": {
      return `- ${stamp} 🔁 Lifecycle ${event.phase}${event.detail ? ` ${stringifyInline(event.detail)}` : ""}`;
    }
    default:
      return `- ${stamp} 📄 ${event.type || "event"} ${stringifyInline(event)}`;
  }
}

function buildMarkdown(payload) {
  const lines = ["# Setup Wizard Transcript", ""];
  const metadata = payload.metadata || {};
  if (metadata.runId) lines.push(`- Run ID: \`${metadata.runId}\``);
  if (metadata.startedAt) lines.push(`- Started: ${metadata.startedAt}`);
  if (metadata.finishedAt) lines.push(`- Finished: ${metadata.finishedAt}`);
  if (metadata.durationHuman)
    lines.push(
      `- Duration: ${metadata.durationHuman} (${metadata.durationMs} ms)`,
    );
  if (metadata.currentMode) lines.push(`- Mode: ${metadata.currentMode}`);
  if (metadata.hostname) lines.push(`- Host: ${metadata.hostname}`);
  if (metadata.exitCode !== undefined)
    lines.push(`- Exit code: ${metadata.exitCode}`);
  if (metadata.environment)
    lines.push(`- Environment: \`${JSON.stringify(metadata.environment)}\``);
  lines.push("");

  if (metadata.flags) {
    lines.push("## Flags");
    lines.push("```json");
    lines.push(JSON.stringify(metadata.flags, null, 2));
    lines.push("```");
    lines.push("");
  }

  if (metadata.issues) {
    lines.push("## Detected Issues");
    lines.push("```json");
    lines.push(JSON.stringify(metadata.issues, null, 2));
    lines.push("```");
    lines.push("");
  }

  if (metadata.modeHistory) {
    lines.push("## Mode History");
    lines.push("```json");
    lines.push(JSON.stringify(metadata.modeHistory, null, 2));
    lines.push("```");
    lines.push("");
  }

  lines.push("## Events");
  for (const event of payload.events || []) {
    lines.push(formatEventLine(event));
  }

  lines.push("");
  return `${lines.join("\n")}`;
}

function formatTimestampForFilename(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

async function resolveLogPaths(rootDir, startedAt) {
  const logDir = path.join(rootDir, "logs");
  const baseName = `setup-${formatTimestampForFilename(startedAt || new Date())}`;
  let attempt = 0;
  while (attempt < 50) {
    const suffix = attempt === 0 ? "" : `-${String(attempt).padStart(2, "0")}`;
    const mdPath = path.join(logDir, `${baseName}${suffix}.md`);
    const jsonPath = path.join(logDir, `${baseName}${suffix}.json`);
    try {
      await fs.access(mdPath);
      attempt += 1;
      continue;
    } catch {
      return { mdPath, jsonPath };
    }
  }
  throw new Error("Unable to determine a unique log file path.");
}

export function createSetupLogger({ rootDir }) {
  const context = {
    rootDir,
    events: [],
    startedAt: null,
    finishedAt: null,
    runId: null,
    metadata: {},
    activeTasks: new Map(),
    taskCounter: 0,
  };

  function ensureStarted() {
    if (!context.startedAt) {
      context.startedAt = new Date();
    }
    if (!context.runId) {
      context.runId = crypto.randomUUID();
    }
  }

  function pushEvent(event) {
    ensureStarted();
    const payload = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
    };
    context.events.push(scrub(payload));
  }

  return {
    beginRun(initial = {}) {
      context.events = [];
      context.activeTasks.clear();
      context.taskCounter = 0;
      context.startedAt = new Date();
      context.finishedAt = null;
      context.runId = crypto.randomUUID();
      context.metadata = scrub({
        runId: context.runId,
        hostname: os.hostname(),
        rootDir,
        ...initial,
      });
      pushEvent({
        type: "lifecycle",
        phase: "run-start",
        detail: { mode: initial.currentMode },
      });
    },
    updateMetadata(partial = {}) {
      context.metadata = {
        ...context.metadata,
        ...scrub(partial),
      };
    },
    recordPrompt(promptType, options, response, extras = {}) {
      const sanitizedExtras = scrub(extras);
      pushEvent({
        type: "prompt",
        promptType,
        name: options?.name,
        message: options?.message,
        options: summarizePromptOptions(options),
        response: scrub(response, options?.name ? [options.name] : []),
        interactive:
          sanitizedExtras?.interactive !== undefined
            ? sanitizedExtras.interactive
            : true,
        reason: sanitizedExtras?.reason,
        extras: sanitizedExtras,
      });
    },
    recordDecision(kind, detail = {}) {
      pushEvent({ type: "decision", kind, detail: scrub(detail) });
    },
    startTask(title, meta = {}) {
      ensureStarted();
      const id = `task-${++context.taskCounter}`;
      const startedAt = Date.now();
      context.activeTasks.set(id, { title, startedAt });
      pushEvent({ type: "task-start", id, title, meta: scrub(meta) });
      let completed = false;
      return {
        complete(status, detail = {}) {
          if (completed) return;
          completed = true;
          context.activeTasks.delete(id);
          const durationMs = Date.now() - startedAt;
          pushEvent({
            type: "task-end",
            id,
            title,
            status,
            durationMs,
            detail: scrub(detail),
            meta: scrub(meta),
          });
        },
      };
    },
    recordMessage(level, text, detail = {}) {
      pushEvent({ type: "message", level, text, detail: scrub(detail) });
    },
    async finalize({ exitCode = 0, metadata = {}, issues = {}, error } = {}) {
      ensureStarted();
      context.finishedAt = new Date();
      const durationMs = context.finishedAt - context.startedAt;
      const combinedMetadata = scrub({
        ...context.metadata,
        ...metadata,
        issues: { ...context.metadata?.issues, ...issues },
        startedAt: context.startedAt.toISOString(),
        finishedAt: context.finishedAt.toISOString(),
        durationMs,
        durationHuman: humanizeDuration(Math.max(1, Math.round(durationMs)), {
          largest: 2,
          round: true,
        }),
        exitCode,
      });
      context.metadata = combinedMetadata;
      pushEvent({
        type: "lifecycle",
        phase: "run-complete",
        detail: {
          exitCode,
          error: error ? scrub(error) : undefined,
        },
      });

      const payload = {
        metadata: { ...combinedMetadata, runId: context.runId },
        events: context.events,
      };

      const { mdPath, jsonPath } = await resolveLogPaths(
        rootDir,
        context.startedAt,
      );
      await fs.mkdir(path.dirname(mdPath), { recursive: true });
      await fs.writeFile(
        jsonPath,
        `${JSON.stringify(payload, null, 2)}\n`,
        "utf8",
      );
      await fs.writeFile(mdPath, `${buildMarkdown(payload)}\n`, "utf8");
      return { mdPath, jsonPath };
    },
  };
}
