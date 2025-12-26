import cliProgress from "cli-progress";

export const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = Math.max(0, bytes);
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const precision = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
};

export const parseBuildkitProgress = (line) => {
  const trimmed = line?.trim();
  if (!trimmed || trimmed[0] !== "{") return null;
  let payload;
  try {
    payload = JSON.parse(trimmed);
  } catch {
    return null;
  }
  const detail = payload?.progressDetail;
  if (!detail || detail.total == null) return null;
  const total = Number(detail.total);
  const current = Number(detail.current ?? 0);
  if (!Number.isFinite(total) || total <= 0) return null;
  if (!Number.isFinite(current)) return null;
  const id = payload.id || payload.status || "unknown";
  return {
    id,
    current: Math.max(0, Math.min(current, total)),
    total,
  };
};

export class BuildByteTracker {
  constructor() {
    this.entries = new Map();
  }

  updateFromLine(line) {
    const progress = parseBuildkitProgress(line);
    if (!progress) return null;
    const existing = this.entries.get(progress.id);
    if (
      !existing ||
      existing.total !== progress.total ||
      existing.current !== progress.current
    ) {
      this.entries.set(progress.id, {
        current: progress.current,
        total: progress.total,
      });
      return this.getTotals();
    }
    return null;
  }

  getTotals() {
    let totalBytes = 0;
    let currentBytes = 0;
    for (const entry of this.entries.values()) {
      totalBytes += entry.total;
      currentBytes += Math.min(entry.current, entry.total);
    }
    return { totalBytes, currentBytes };
  }
}

export const createByteProgressBar = (format) =>
  new cliProgress.SingleBar(
    {
      format,
      hideCursor: true,
      barsize: 28,
      clearOnComplete: false,
      stopOnComplete: false,
      autopadding: true,
    },
    cliProgress.Presets.shades_classic,
  );
