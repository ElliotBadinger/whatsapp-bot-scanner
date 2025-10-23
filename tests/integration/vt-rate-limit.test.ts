import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('undici', () => ({ fetch: vi.fn() }));

afterEach(async () => {
  const shared = await import('@wbscanner/shared');
  shared.register.resetMetrics();
  vi.clearAllMocks();
  vi.resetModules();
});

describe('VirusTotal quota handling', () => {
  it('throws QuotaExceededError and flips quota gauge on HTTP 429', async () => {
    const fetchMock = vi.mocked((await import('undici')).fetch);
    fetchMock.mockResolvedValueOnce({
      status: 429,
      json: async () => ({}),
    } as any);

    const { vtAnalyzeUrl, QuotaExceededError, register } = await import('@wbscanner/shared');

    await expect(vtAnalyzeUrl('http://example.test')).rejects.toBeInstanceOf(QuotaExceededError);

    const metrics = await register.metrics();
    expect(metrics).toMatch(/wbscanner_api_quota_status\{service="virustotal"\} 0/);
  });
});
