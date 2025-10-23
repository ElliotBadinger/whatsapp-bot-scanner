const CONFIG_PATH = '../config';

describe('queue configuration validation', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  it('provides hyphenated defaults without colons', () => {
    process.env.URLSCAN_CALLBACK_SECRET = 'test-secret';
    process.env.CONTROL_PLANE_API_TOKEN = 'test-token';

    jest.isolateModules(() => {
      const { config } = require(CONFIG_PATH) as typeof import('../config');
      expect(config.queues.scanRequest).toBe('scan-request');
      expect(config.queues.scanVerdict).toBe('scan-verdict');
      expect(config.queues.urlscan).toBe('scan-urlscan');
      expect(config.vt.requestsPerMinute).toBe(4);
      expect(config.vt.requestJitterMs).toBe(500);
    });
  });

  it('throws when queue name contains colon characters', () => {
    process.env.URLSCAN_CALLBACK_SECRET = 'test-secret';
    process.env.SCAN_REQUEST_QUEUE = 'scan:request';
    process.env.CONTROL_PLANE_API_TOKEN = 'test-token';

    expect(() => {
      jest.isolateModules(() => {
        require(CONFIG_PATH);
      });
    }).toThrow(/must not contain ':'/);
  });

  it('falls back to defaults when VT rate configs invalid', () => {
    process.env.URLSCAN_CALLBACK_SECRET = 'test-secret';
    process.env.VT_REQUESTS_PER_MINUTE = '-1';
    process.env.VT_REQUEST_JITTER_MS = '-100';
    process.env.CONTROL_PLANE_API_TOKEN = 'test-token';

    jest.isolateModules(() => {
      const { config } = require(CONFIG_PATH) as typeof import('../config');
      expect(config.vt.requestsPerMinute).toBe(4);
      expect(config.vt.requestJitterMs).toBe(500);
    });
  });

  it('throws when urlscan enabled without callback secret', () => {
    delete process.env.URLSCAN_CALLBACK_SECRET;
    process.env.URLSCAN_ENABLED = 'true';
    process.env.CONTROL_PLANE_API_TOKEN = 'test-token';

    expect(() => {
      jest.isolateModules(() => {
        require(CONFIG_PATH);
      });
    }).toThrow(/URLSCAN_CALLBACK_SECRET must be provided/);
  });

  it('allows missing secret when urlscan disabled', () => {
    delete process.env.URLSCAN_CALLBACK_SECRET;
    process.env.URLSCAN_ENABLED = 'false';
    process.env.CONTROL_PLANE_API_TOKEN = 'test-token';

    jest.isolateModules(() => {
      const { config } = require(CONFIG_PATH) as typeof import('../config');
      expect(config.urlscan.enabled).toBe(false);
      expect(config.urlscan.callbackSecret).toBe('');
    });
  });

  it('throws when control plane token missing', () => {
    process.env.URLSCAN_CALLBACK_SECRET = 'test-secret';
    delete process.env.CONTROL_PLANE_API_TOKEN;

    expect(() => {
      jest.isolateModules(() => {
        const { config } = require(CONFIG_PATH) as typeof import('../config');
        // Access token to trigger validation
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        config.controlPlane.token;
      });
    }).toThrow(/CONTROL_PLANE_API_TOKEN must not be empty/);
  });
});
