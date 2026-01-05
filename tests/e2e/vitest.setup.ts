import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { vi } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

vi.mock("ioredis", () => ({
  __esModule: true,
  default: class RedisMock {
    private readonly strings = new Map<string, string>();
    private readonly lists = new Map<string, string[]>();

    on = vi.fn();
    quit = vi.fn();
    duplicate = vi.fn(() => new RedisMock());

    async get(key: string): Promise<string | null> {
      return this.strings.get(key) ?? null;
    }

    async set(key: string, value: string): Promise<"OK"> {
      this.strings.set(key, value);
      return "OK";
    }

    async del(...keys: string[]): Promise<number> {
      let removed = 0;
      for (const key of keys) {
        if (this.strings.delete(key)) removed += 1;
        if (this.lists.delete(key)) removed += 1;
      }
      return removed;
    }

    async expire(): Promise<number> {
      return 1;
    }

    async keys(pattern: string): Promise<string[]> {
      if (pattern === "*") {
        return [...new Set([...this.strings.keys(), ...this.lists.keys()])];
      }
      // Minimal glob support for existing tests (prefix* patterns).
      if (pattern.endsWith("*")) {
        const prefix = pattern.slice(0, -1);
        return [
          ...new Set([...this.strings.keys(), ...this.lists.keys()]),
        ].filter((k) => k.startsWith(prefix));
      }
      return [
        ...new Set([...this.strings.keys(), ...this.lists.keys()]),
      ].filter((k) => k === pattern);
    }

    async lpush(key: string, ...values: string[]): Promise<number> {
      const list = this.lists.get(key) ?? [];
      for (const value of values) {
        list.unshift(value);
      }
      this.lists.set(key, list);
      return list.length;
    }

    async ltrim(key: string, start: number, stop: number): Promise<"OK"> {
      const list = this.lists.get(key) ?? [];
      const normalizedStop = stop < 0 ? list.length + stop : stop;
      const trimmed = list.slice(start, normalizedStop + 1);
      this.lists.set(key, trimmed);
      return "OK";
    }

    async lrange(key: string, start: number, stop: number): Promise<string[]> {
      const list = this.lists.get(key) ?? [];
      const normalizedStop = stop < 0 ? list.length + stop : stop;
      return list.slice(start, normalizedStop + 1);
    }
  },
}));

vi.mock("bullmq", () => ({
  Queue: class QueueMock {
    add = vi.fn();
    on = vi.fn();
    constructor() {
      // no-op
    }
  },
  Worker: class WorkerMock {
    on = vi.fn();
    constructor() {
      // no-op
    }
  },
}));

process.env.URLSCAN_CALLBACK_SECRET =
  process.env.URLSCAN_CALLBACK_SECRET || "test-secret";
process.env.CONTROL_PLANE_API_TOKEN =
  process.env.CONTROL_PLANE_API_TOKEN || "test-token";
process.env.IDENTIFIER_HASH_SECRET =
  process.env.IDENTIFIER_HASH_SECRET || "e2e-test-secret";
process.env.VT_API_KEY = process.env.VT_API_KEY || "test-vt-key";
process.env.GSB_API_KEY = process.env.GSB_API_KEY || "test-gsb-key";
process.env.REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379/0";
process.env.SQLITE_DB_PATH =
  process.env.SQLITE_DB_PATH || resolve(repoRoot, "storage/wbscanner.db");
process.env.SCAN_REQUEST_QUEUE =
  process.env.SCAN_REQUEST_QUEUE || "scan-request";
process.env.WHOISXML_API_KEY = process.env.WHOISXML_API_KEY || "test-whois-key";
process.env.GSB_API_KEY = process.env.GSB_API_KEY || "test-gsb-key";
process.env.URLSCAN_ARTIFACT_DIR =
  process.env.URLSCAN_ARTIFACT_DIR ||
  resolve(repoRoot, "storage/urlscan-artifacts");

mkdirSync(process.env.URLSCAN_ARTIFACT_DIR, { recursive: true });
