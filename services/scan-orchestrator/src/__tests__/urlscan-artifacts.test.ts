import path from 'node:path';
import fs from 'node:fs/promises';

const mockCounterInc = jest.fn();
const mockLabels = jest.fn().mockReturnValue({ inc: mockCounterInc });

jest.mock('undici', () => ({
  fetch: jest.fn(),
}));

jest.mock('@wbscanner/shared', () => ({
  config: {
    urlscan: { baseUrl: 'https://urlscan.io' },
    security: { externalFetchAllowlist: ['urlscan.io'] },
  },
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
  },
  metrics: {
    artifactDownloadFailures: { labels: mockLabels },
  },
  isPrivateHostname: jest.fn(async () => false),
  sanitizeForLogging: (value: unknown) => value,
}));

describe('downloadUrlscanArtifacts', () => {
  let downloadUrlscanArtifacts: typeof import('../urlscan-artifacts').downloadUrlscanArtifacts;
  let fetchMock: jest.Mock;
  let shared: any;

  beforeEach(async () => {
    jest.resetModules();
    fetchMock = require('undici').fetch as jest.Mock;
    fetchMock.mockReset();
    shared = require('@wbscanner/shared');
    mockCounterInc.mockReset();
    mockLabels.mockClear();
    shared.isPrivateHostname.mockResolvedValue(false);
    shared.config.urlscan.baseUrl = 'https://urlscan.io';
    process.env.URLSCAN_ARTIFACT_DIR = path.resolve('storage/urlscan-artifacts-test');
    jest.isolateModules(() => {
      ({ downloadUrlscanArtifacts } = require('../urlscan-artifacts'));
    });
    await fs.rm(process.env.URLSCAN_ARTIFACT_DIR, { recursive: true, force: true }).catch(() => {});
  });

  afterEach(async () => {
    await fs.rm(process.env.URLSCAN_ARTIFACT_DIR as string, { recursive: true, force: true }).catch(() => {});
  });

  it('blocks unsafe urlscan base URLs', async () => {
    shared.config.urlscan.baseUrl = 'http://127.0.0.1';
    shared.isPrivateHostname.mockResolvedValueOnce(true);

    const result = await downloadUrlscanArtifacts('scan-id', 'hash');

    expect(result).toEqual({ screenshotPath: null, domPath: null });
    expect(mockLabels).toHaveBeenCalledWith('screenshot', 'urlscan_base_blocked');
    expect(mockLabels).toHaveBeenCalledWith('dom', 'urlscan_base_blocked');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('persists artifacts when downloads succeed', async () => {
    const screenshotBuffer = Buffer.from('image-bytes');
    const domHtml = '<html><body>ok</body></html>';

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: (name: string) => (name === 'content-length' ? String(screenshotBuffer.length) : null) },
        arrayBuffer: async () => screenshotBuffer,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => domHtml,
      });

    const result = await downloadUrlscanArtifacts('scan-id', 'hash');

    expect(result.screenshotPath).toBeTruthy();
    expect(result.domPath).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const screenshotStat = await fs.stat(result.screenshotPath as string);
    expect(screenshotStat.size).toBe(screenshotBuffer.length);

    const domContents = await fs.readFile(result.domPath as string, 'utf8');
    expect(domContents).toBe(domHtml);
  });
});
