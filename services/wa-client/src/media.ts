import { existsSync } from "node:fs";
import path from "node:path";
import { MessageMedia } from "whatsapp-web.js";
import type { Logger } from "pino";

interface VerdictJobData {
  urlHash: string;
  urlscan?: { screenshotPath?: string | null; artifactPath?: string | null };
  artifacts?: { screenshotPath?: string | null; badgePath?: string | null };
}

function resolveCandidatePaths(job: VerdictJobData): string[] {
  const candidates = new Set<string>();
  const collect = (value?: string | null) => {
    if (value) candidates.add(path.resolve(value));
  };
  collect(job.urlscan?.screenshotPath ?? undefined);
  collect(job.artifacts?.screenshotPath ?? undefined);
  collect(job.artifacts?.badgePath ?? undefined);
  const mediaDir = process.env.WA_VERDICT_MEDIA_DIR;
  if (mediaDir) {
    const pngPath = path.join(mediaDir, `${job.urlHash}.png`);
    const jpgPath = path.join(mediaDir, `${job.urlHash}.jpg`);
    const webpPath = path.join(mediaDir, `${job.urlHash}.webp`);
    [pngPath, jpgPath, webpPath].forEach((p) => candidates.add(p));
  }
  return Array.from(candidates);
}

export async function buildVerdictMedia(
  job: VerdictJobData,
  logger: Logger,
): Promise<{ media: MessageMedia; caption?: string } | null> {
  const files = resolveCandidatePaths(job);
  for (const file of files) {
    if (!existsSync(file)) continue;
    try {
      const media = await MessageMedia.fromFilePath(file);
      return { media };
    } catch (err) {
      logger.warn({ err, file }, "Failed to load verdict attachment");
    }
  }
  return null;
}
