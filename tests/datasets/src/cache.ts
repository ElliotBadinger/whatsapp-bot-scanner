import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export async function ensureCachedBytes(
  url: string,
  destPath: string,
  { maxAgeMs, headers }: { maxAgeMs: number; headers?: Record<string, string> },
): Promise<Uint8Array> {
  const now = Date.now();
  let staleBytes: Uint8Array | null = null;
  try {
    const info = await stat(destPath);
    if (now - info.mtimeMs < maxAgeMs) {
      return new Uint8Array(await readFile(destPath));
    }
    staleBytes = new Uint8Array(await readFile(destPath));
  } catch {
    // cache miss
  }

  const attempts = 3;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(60_000),
        headers: {
          "User-Agent": "wbscanner-dataset-tests/1.0",
          ...headers,
        },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      await mkdir(dirname(destPath), { recursive: true });
      await writeFile(destPath, bytes);
      return bytes;
    } catch (err) {
      if (attempt === attempts) {
        if (staleBytes) {
          return staleBytes;
        }
        throw err;
      }
      await new Promise((r) => setTimeout(r, 250 * attempt));
    }
  }

  if (staleBytes) return staleBytes;
  throw new Error(`Failed to fetch ${url}`);
}

export async function ensureCachedText(
  url: string,
  destPath: string,
  { maxAgeMs, headers }: { maxAgeMs: number; headers?: Record<string, string> },
): Promise<string> {
  const bytes = await ensureCachedBytes(url, destPath, { maxAgeMs, headers });
  return new TextDecoder().decode(bytes);
}

export function storagePath(relative: string): string {
  return resolveFromRepoRoot(`storage/datasets/${relative}`);
}

function resolveFromRepoRoot(pathFromRoot: string): string {
  // tests run with CWD at the workspace root; resolve relative to repo root.
  return fileURLToPath(new URL(`../../../${pathFromRoot}`, import.meta.url));
}
