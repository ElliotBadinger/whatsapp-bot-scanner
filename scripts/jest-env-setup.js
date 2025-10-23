process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.URLSCAN_CALLBACK_SECRET = process.env.URLSCAN_CALLBACK_SECRET || 'test-secret';
process.env.CONTROL_PLANE_API_TOKEN = process.env.CONTROL_PLANE_API_TOKEN || 'test-token';
process.env.VT_API_KEY = process.env.VT_API_KEY || 'test-vt-key';
process.env.GSB_API_KEY = process.env.GSB_API_KEY || 'test-gsb-key';
process.env.WHOISXML_API_KEY = process.env.WHOISXML_API_KEY || 'test-whois-key';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379/0';
process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || 'localhost';
process.env.POSTGRES_PORT = process.env.POSTGRES_PORT || '5432';
process.env.POSTGRES_DB = process.env.POSTGRES_DB || 'wbscanner';
process.env.POSTGRES_USER = process.env.POSTGRES_USER || 'wbscanner';
process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || 'wbscanner';

jest.mock('ioredis', () => {
  class RedisMock {
    constructor() {
      this.store = new Map();
    }

    async set(key, value) {
      this.store.set(key, value);
      return 'OK';
    }

    async del(...keys) {
      let removed = 0;
      for (const key of keys) {
        if (this.store.delete(key)) {
          removed += 1;
        }
      }
      return removed;
    }

    async get(key) {
      return this.store.get(key) ?? null;
    }
  }

  return {
    __esModule: true,
    default: RedisMock,
  };
});

jest.mock('bullmq', () => {
  const queueAdd = jest.fn().mockResolvedValue(undefined);
  const Queue = jest.fn().mockImplementation(() => ({
    add: queueAdd,
    on: jest.fn(),
  }));
  const Worker = jest.fn();
  return { Queue, Worker };
});
