import { mkdirSync } from 'node:fs';
import { vi } from 'vitest';

vi.mock('ioredis', () => ({
  __esModule: true,
  default: class RedisMock {
    on = vi.fn();
    quit = vi.fn();
    duplicate = vi.fn(() => new RedisMock());
  },
}));

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({ add: vi.fn(), on: vi.fn() })),
  Worker: vi.fn().mockImplementation(() => ({ on: vi.fn() })),
}));

process.env.URLSCAN_CALLBACK_SECRET = process.env.URLSCAN_CALLBACK_SECRET || 'test-secret';
process.env.CONTROL_PLANE_API_TOKEN = process.env.CONTROL_PLANE_API_TOKEN || 'test-token';
process.env.VT_API_KEY = process.env.VT_API_KEY || 'test-vt-key';
process.env.GSB_API_KEY = process.env.GSB_API_KEY || 'test-gsb-key';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379/0';
process.env.SQLITE_DB_PATH = process.env.SQLITE_DB_PATH || './storage/wbscanner.db';
process.env.SCAN_REQUEST_QUEUE = process.env.SCAN_REQUEST_QUEUE || 'scan-request';
process.env.WHOISXML_API_KEY = process.env.WHOISXML_API_KEY || 'test-whois-key';
process.env.GSB_API_KEY = process.env.GSB_API_KEY || 'test-gsb-key';

mkdirSync('storage/urlscan-artifacts', { recursive: true });
