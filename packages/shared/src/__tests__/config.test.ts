const CONFIG_PATH = "../config";

describe("queue configuration validation", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  it("provides hyphenated defaults without colons", () => {
    process.env.URLSCAN_CALLBACK_SECRET = "test-secret";
    process.env.CONTROL_PLANE_API_TOKEN = "test-token";

    jest.isolateModules(() => {
      const { config } = require(CONFIG_PATH) as typeof import("../config");
      expect(config.queues.scanRequest).toBe("scan-request");
      expect(config.queues.scanVerdict).toBe("scan-verdict");
      expect(config.queues.urlscan).toBe("scan-urlscan");
      expect(config.features.attachMediaToVerdicts).toBe(false);
      expect(config.wa.verdictAckTimeoutSeconds).toBeGreaterThan(0);
    });
  });

  it("throws when queue name contains colon characters", () => {
    process.env.URLSCAN_CALLBACK_SECRET = "test-secret";
    process.env.SCAN_REQUEST_QUEUE = "scan:request";
    process.env.CONTROL_PLANE_API_TOKEN = "test-token";

    expect(() => {
      jest.isolateModules(() => {
        require(CONFIG_PATH);
      });
    }).toThrow(/must not contain ':'/);
  });

  it("throws when urlscan enabled without callback secret", () => {
    delete process.env.URLSCAN_CALLBACK_SECRET;
    process.env.URLSCAN_ENABLED = "true";
    process.env.URLSCAN_API_KEY = "test-urlscan-key";
    process.env.URLSCAN_CALLBACK_URL = "https://example.test/urlscan/callback";
    process.env.CONTROL_PLANE_API_TOKEN = "test-token";

    expect(() => {
      jest.isolateModules(() => {
        require(CONFIG_PATH);
      });
    }).toThrow(
      /URLSCAN_CALLBACK_SECRET must be provided when URLSCAN_ENABLED=true and URLSCAN_CALLBACK_URL is set/,
    );
  });

  it("treats urlscan as disabled when api key missing even if URLSCAN_ENABLED=true", () => {
    delete process.env.URLSCAN_CALLBACK_SECRET;
    process.env.URLSCAN_ENABLED = "true";
    process.env.URLSCAN_API_KEY = "";
    process.env.URLSCAN_CALLBACK_URL = "https://example.test/urlscan/callback";
    process.env.CONTROL_PLANE_API_TOKEN = "test-token";

    jest.isolateModules(() => {
      const { config } = require(CONFIG_PATH) as typeof import("../config");
      expect(config.urlscan.enabled).toBe(false);
      expect(config.urlscan.callbackSecret).toBe("");
    });
  });

  it("allows missing secret when urlscan disabled", () => {
    delete process.env.URLSCAN_CALLBACK_SECRET;
    process.env.URLSCAN_ENABLED = "false";
    process.env.CONTROL_PLANE_API_TOKEN = "test-token";

    jest.isolateModules(() => {
      const { config } = require(CONFIG_PATH) as typeof import("../config");
      expect(config.urlscan.enabled).toBe(false);
      expect(config.urlscan.callbackSecret).toBe("");
    });
  });

  it("throws when control plane token missing", () => {
    process.env.URLSCAN_CALLBACK_SECRET = "test-secret";
    delete process.env.CONTROL_PLANE_API_TOKEN;

    expect(() => {
      jest.isolateModules(() => {
        const { config } = require(CONFIG_PATH) as typeof import("../config");
        // Access token to trigger validation
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        config.controlPlane.token;
      });
    }).toThrow(/CONTROL_PLANE_API_TOKEN must not be empty/);
  });
});
