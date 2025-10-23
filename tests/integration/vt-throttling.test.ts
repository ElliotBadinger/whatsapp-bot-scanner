import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('undici', () => ({
  __esModule: true,
  fetch: vi.fn(),
}));

afterEach(async () => {
  vi.useRealTimers();
  try {
    const shared = await import('@wbscanner/shared');
    shared.register.resetMetrics();
  } catch {}
  const bottleneck = await import('bottleneck');
  if (Array.isArray((bottleneck as any).__instances)) {
    (bottleneck as any).__instances.length = 0;
  }
  vi.clearAllMocks();
});

describe('VirusTotal throttling integration', () => {
  it('queues follow-up analysis and records rate limiter delay', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));

    const undici = await import('undici');
    const vtResponses = [
      { status: 200, json: async () => ({ data: { id: 'analysis-1' } }) },
      {
        status: 200,
        json: async () => ({ data: { attributes: { status: 'completed', stats: { malicious: 0, suspicious: 0, harmless: 1 } } } }),
      },
      { status: 200, json: async () => ({ data: { id: 'analysis-2' } }) },
      {
        status: 200,
        json: async () => ({ data: { attributes: { status: 'completed', stats: { malicious: 1, suspicious: 0, harmless: 0 } } } }),
      },
    ];

    vi.mocked(undici.fetch).mockImplementation(async () => vtResponses.shift() as any);

    const shared = await import('@wbscanner/shared');
    const { vtAnalyzeUrl, rateLimiterDelay } = shared;
    const bottleneck = await import('bottleneck');
    const limiter = (bottleneck as any).__instances[0];
    expect(limiter).toBeDefined();

    const first = vtAnalyzeUrl('http://example.test/first');
    await vi.advanceTimersByTimeAsync(0);
    await first;
    limiter.reservoir = 0;
    expect(vi.mocked(undici.fetch)).toHaveBeenCalledTimes(2);

    const secondPromise = vtAnalyzeUrl('http://example.test/second');
    expect(limiter.getQueueLength()).toBe(1);

    vi.setSystemTime(new Date(Date.now() + 500));
    limiter.release(2);

    await vi.advanceTimersByTimeAsync(0);
    await secondPromise;

    expect(vi.mocked(undici.fetch)).toHaveBeenCalledTimes(4);

    const histogram = await rateLimiterDelay.get();
    const vtCount = histogram?.values?.find(
      (value: any) =>
        value.metricName === 'wbscanner_rate_limiter_delay_seconds_count' &&
        value.labels.service === 'virustotal'
    );
    expect(vtCount?.value ?? 0).toBeGreaterThanOrEqual(1);
  });
});
