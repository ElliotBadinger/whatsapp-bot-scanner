import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const DEFAULT_PREFERENCES = {
  mode: "guided",
  lastRunAt: null,
  glossarySeen: false,
};

function getPreferencesPath(rootDir) {
  const overrideDir = process.env.SETUP_CACHE_DIR;
  const cacheDir = overrideDir
    ? path.resolve(overrideDir)
    : path.join(rootDir, ".setup");
  return { cacheDir, filePath: path.join(cacheDir, "preferences.json") };
}

export async function readPreferences(rootDir) {
  const { cacheDir, filePath } = getPreferencesPath(rootDir);
  try {
    await fs.mkdir(cacheDir, { recursive: true });
    const raw = await fs.readFile(filePath, "utf8");
    const data = JSON.parse(raw);
    return { ...DEFAULT_PREFERENCES, ...data };
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.warn(`Unable to read setup preferences: ${err.message}`);
    }
    return { ...DEFAULT_PREFERENCES };
  }
}

export async function writePreferences(rootDir, preferences) {
  const { cacheDir, filePath } = getPreferencesPath(rootDir);
  await fs.mkdir(cacheDir, { recursive: true });
  const payload = {
    ...DEFAULT_PREFERENCES,
    ...preferences,
    lastRunAt: new Date().toISOString(),
  };
  await fs.writeFile(
    filePath,
    JSON.stringify(payload, null, 2) + os.EOL,
    "utf8",
  );
  return payload;
}

export function getDefaultPreferences() {
  return { ...DEFAULT_PREFERENCES };
}
