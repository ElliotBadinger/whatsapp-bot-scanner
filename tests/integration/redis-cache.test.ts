import { afterEach, describe, expect, it, vi } from 'vitest';

const redisState = {
  store: new Map<string, string>(),
  getMock: vi.fn(async (key: string) => redisState.store.get(key) ?? null),
  setMock: vi.fn(async (key: string, value: string) => {
    redisState.store.set(key, value);
    return 'OK';
  }),
  delMock: vi.fn(async (key: string) => {
    const existed = redisState.store.delete(key);
    return existed ? 1 : 0;
  }),
};

vi.mock('ioredis', () => ({
  __esModule: true,
  default: class RedisMock {
    get(key: string) {
      return redisState.getMock(key);
    }
    set(key: string, value: string, _mode?: string, _ttl?: number) {
      return redisState.setMock(key, value);
    }
    del(key: string) {
      return redisState.delMock(key);
    }
    on = vi.fn();
    quit = vi.fn();
  },
}));

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn(),
    on: vi.fn(),
    getWaitingCount: vi.fn().mockResolvedValue(0),
  })),
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
  })),
}));

vi.mock('pg', () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    query: vi.fn(),
  })),
}));

vi.mock('undici', () => ({
  __esModule: true,
  request: vi.fn(),
}));

afterEach(() => {
  redisState.store.clear();
  redisState.getMock.mockClear();
  redisState.setMock.mockClear();
  redisState.delMock.mockClear();
  vi.clearAllMocks();
});

describe('Scan orchestrator Redis caching', () => {
  it('stores and reuses cached GSB results', async () => {
    const undici = await import('undici');
    vi.mocked(undici.request).mockResolvedValue({
      statusCode: 200,
      body: {
        json: async () => ({
          matches: [
            {
              threatType: 'MALWARE',
              platformType: 'ANY_PLATFORM',
              threatEntryType: 'URL',
              threat: { url: 'https://cache.test' },
            },
          ],
        }),
      },
    } as any);

    const orchestrator = await import('../../services/scan-orchestrator/src/index');
    const { fetchGsbAnalysis } = orchestrator.__testables;

    const first = await fetchGsbAnalysis('https://cache.test', 'abc123');

    expect(first.fromCache).toBe(false);
    expect(redisState.getMock).toHaveBeenCalledWith('url:analysis:abc123:gsb');
    expect(redisState.setMock).toHaveBeenCalledWith(
      'url:analysis:abc123:gsb',
      expect.stringContaining('"threatType":"MALWARE"')
    );

    const requestCount = vi.mocked(undici.request).mock.calls.length;

    const second = await fetchGsbAnalysis('https://cache.test', 'abc123');
    expect(second.fromCache).toBe(true);
    expect(vi.mocked(undici.request).mock.calls.length).toBe(requestCount);
    expect(second.matches[0]?.threat).toBe('https://cache.test');
  });
});
