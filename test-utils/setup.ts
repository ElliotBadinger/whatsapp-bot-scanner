// Mock timers for deterministic testing.
export function mockTime(timestamp: number) {
  jest.useFakeTimers();
  jest.setSystemTime(timestamp);
}

export function restoreTime() {
  jest.useRealTimers();
}

// Mock Redis client.
export function createMockRedis() {
  const store = new Map<string, string>();

  return {
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    set: jest.fn(async (key: string, value: string, ..._args: unknown[]) => {
      store.set(key, value);
      return 'OK';
    }),
    del: jest.fn(async (key: string) => {
      store.delete(key);
      return 1;
    }),
    exists: jest.fn(async (key: string) => (store.has(key) ? 1 : 0)),
    ttl: jest.fn(async (_key: string) => -1),
    ping: jest.fn(async () => 'PONG'),
    quit: jest.fn(async () => 'OK'),
  };
}

// Mock PostgreSQL client.
export function createMockDatabase() {
  return {
    query: jest.fn(async (_sql: string, _params?: unknown[]) => ({
      rows: [],
    })),
    transaction: jest.fn(async (callback: () => Promise<void>) => {
      await callback();
    }),
  };
}

// Mock BullMQ Queue.
export function createMockQueue(name: string) {
  const jobs: Array<{ id: string; name: string; data: unknown }> = [];

  return {
    name,
    add: jest.fn(async (jobName: string, data: unknown, _opts?: unknown) => {
      const job = { id: `${name}-${jobs.length}`, name: jobName, data };
      jobs.push(job);
      return job;
    }),
    getJobs: jest.fn(async () => jobs),
    getJobCounts: jest.fn(async () => ({
      waiting: 0,
      active: 0,
      delayed: 0,
      failed: 0,
    })),
    close: jest.fn(async () => {}),
  };
}
