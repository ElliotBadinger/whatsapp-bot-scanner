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
  let Redis;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Redis = require('ioredis-mock');
  } catch {
    Redis = class RedisMock {
      constructor() {
        this.store = new Map();
      }

      async set(key, value) {
        this.store.set(key, value);
        return 'OK';
      }

      async get(key) {
        return this.store.get(key);
      }

      async del() {
        return 1;
      }

      duplicate() {
        return new RedisMock();
      }

      on() {}

      quit() {}
    };
  }

  return {
    __esModule: true,
    default: Redis,
    ...Redis,
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
