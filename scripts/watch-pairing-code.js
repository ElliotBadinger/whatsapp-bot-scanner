/**
 * Continuously watch wa-client logs and surface pairing-code events with a
 * visual + audible cue. Useful when you cannot stare at the raw docker logs.
 */

import { spawn } from "node:child_process";
import readline from "node:readline";

const PAIRING_CODE_TTL_MS = 160_000;
const REMINDER_INTERVAL_MS = 30_000;

let activeReminder = null;
let activeCode = null;
let expiryTimestamp = 0;

function bell(times = 1) {
  for (let i = 0; i < times; i += 1) {
    try {
      process.stdout.write("\x07");
    } catch {
      // ignore
    }
  }
}

function formatPhone(masked) {
  return masked ?? "unknown";
}

function formatWhen(timestampIso) {
  if (!timestampIso) return "unknown";
  const when = new Date(timestampIso);
  if (Number.isNaN(when.getTime())) return timestampIso;
  return when.toLocaleTimeString();
}

function prettyDelay(ms) {
  if (!Number.isFinite(ms)) return "unknown";
  if (ms >= 60_000) {
    const minutes = Math.round(ms / 60_000);
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
  const seconds = Math.round(ms / 1000);
  return `${seconds} second${seconds === 1 ? "" : "s"}`;
}

function sanitize(line) {
  if (typeof line !== "string") return "";
  const pipeIndex = line.indexOf("|");
  if (pipeIndex >= 0) {
    return line.slice(pipeIndex + 1).trim();
  }
  return line.trim();
}

function speak(text) {
  const volume = process.env.WATCH_PAIRING_VOLUME ?? "0.8";
  let voiceCmd = null;
  if (process.platform === "darwin") {
    voiceCmd = spawn("say", ["-v", "Ava", "-r", "180", text]);
  } else {
    voiceCmd = spawn("espeak", ["-a", String(Number(volume) * 200), text]);
  }
  voiceCmd.on("error", () => {
    // ignore speech errors; bell + console output still work
  });
}

function cancelReminder() {
  if (activeReminder) {
    clearInterval(activeReminder);
    activeReminder = null;
  }
  activeCode = null;
  expiryTimestamp = 0;
}

function scheduleReminder(maskedPhone) {
  cancelReminder();
  activeReminder = setInterval(() => {
    if (!activeCode) {
      cancelReminder();
      return;
    }
    const remaining = expiryTimestamp - Date.now();
    if (remaining <= 0) {
      console.log(
        `[watch] Code ${activeCode} for ${maskedPhone} likely expired.`,
      );
      cancelReminder();
      return;
    }
    bell(2);
    speak(
      `Reminder. Enter WhatsApp pairing code ${activeCode}. ${Math.ceil(remaining / 1000)} seconds remain.`,
    );
  }, REMINDER_INTERVAL_MS);
}

const source =
  process.env.WATCH_PAIRING_SOURCE === "stdin" ? "stdin" : "docker";

let docker;
let inputStream;

if (source === "stdin") {
  inputStream = process.stdin;
  console.log("[watch] Reading pairing events from STDIN (test mode).");
} else {
  docker = spawn("docker", ["compose", "logs", "-f", "wa-client"], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  docker.on("error", (err) => {
    console.error(
      "[watch-pairing-code] Failed to start docker compose logs:",
      err.message,
    );
    process.exitCode = 1;
  });
  inputStream = docker.stdout;
}

const rl = readline.createInterface({ input: inputStream });

function triggerPairingAlert(code, attempt, maskedPhone, expiresAt) {
  bell(3);
  speak(`WhatsApp pairing code ${code} is ready. It expires in two minutes.`);
  console.log("\n=== WhatsApp Pairing Code Available ===");
  console.log(` Code:       ${code}`);
  console.log(` Attempt:    ${attempt}`);
  console.log(` Phone:      ${maskedPhone}`);
  console.log(` Expires at: ${expiresAt.toLocaleTimeString()}`);
  console.log("======================================\n");
  activeCode = code;
  expiryTimestamp = expiresAt.getTime();
  scheduleReminder(maskedPhone);
}

function handleRateLimitEvent(parsed) {
  const maskedPhone = formatPhone(parsed?.phoneNumber);
  const nextAt = formatWhen(parsed?.nextRetryAt);
  const delay = prettyDelay(parsed?.nextRetryMs);
  console.log(
    `[watch] Rate limited for ${maskedPhone}. Next retry in ~${delay} (${nextAt}).`,
  );
  cancelReminder();
}

function handlePairingLine(parsed) {
  const maskedPhone = formatPhone(parsed?.phoneNumber);
  const code = parsed?.code ?? "UNKNOWN";
  const attempt = parsed?.attempt ?? "n/a";
  const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS);
  triggerPairingAlert(code, attempt, maskedPhone, expiresAt);
}

if (source === "docker") {
  console.log("[watch] Live mode. Commands: d=demo alert, q=quit\n");
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", (chunk) => {
      const key = chunk.toString().trim().toLowerCase();
      if (key === "q") {
        shutdown();
        process.exit(0);
      }
      if (key === "d") {
        const demoCode = `DEMO${Math.random().toString(36).toUpperCase().slice(2, 6)}`;
        const masked = "****DEMO";
        const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS);
        console.log("[watch] Running demo alert...");
        triggerPairingAlert(demoCode, "demo", masked, expiresAt);
      }
    });
  } else {
    console.log("[watch] (stdin not TTY; demo shortcuts disabled)");
  }
}

rl.on("line", (rawLine) => {
  const line = sanitize(rawLine);
  if (!line) return;

  let parsed;
  if (line.startsWith("{")) {
    try {
      parsed = JSON.parse(line);
    } catch {
      // plain text line, fall through
    }
  }

  const message = parsed?.msg ?? line;
  if (message.includes("Requested phone-number pairing code")) {
    handlePairingLine(parsed);
    return;
  }

  if (
    message.includes("Failed to request pairing code automatically") &&
    parsed?.rateLimited
  ) {
    handleRateLimitEvent(parsed);
    return;
  }

  if (message.includes("Pairing code not received within timeout")) {
    const maskedPhone = formatPhone(parsed?.phoneNumber);
    console.log(
      `[watch] No code received yet for ${maskedPhone}. Keeping QR suppressed.`,
    );
    cancelReminder();
  }
});

const shutdown = () => {
  rl.close();
  if (docker && !docker.killed) {
    docker.kill("SIGINT");
  }
};

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});

process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});
