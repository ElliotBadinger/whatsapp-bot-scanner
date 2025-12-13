import FakeRedis from "../../src/__tests__/fake-redis";

const noop = () => undefined;
const counter = () => ({ inc: noop, labels: () => ({ inc: noop }) });
const gauge = () => ({ set: noop, labels: () => ({ set: noop }) });
const histogram = () => ({ observe: noop, labels: () => ({ observe: noop }) });

export const config = {
  queues: {
    scanRequest: "scan-request",
  },
  controlPlane: {
    get csrfToken(): string {
      return (
        process.env.CONTROL_PLANE_CSRF_TOKEN ||
        process.env.CONTROL_PLANE_API_TOKEN ||
        "test-token"
      ).trim();
    },
  },
  wa: {
    authStrategy: "remote",
    qrTerminal: false,
    consentOnJoin: true,
    messageLineageTtlSeconds: 3600,
    verdictMaxRetries: 3,
    remoteAuth: {
      clientId: "default",
      phoneNumbers: [],
      disableQrFallback: false,
      dataPath: "./data",
      backupIntervalMs: 60_000,
    },
  },
};

export const logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
  trace: () => undefined,
  child: () => logger,
};

export const register = {
  contentType: "text/plain; version=0.0.4",
  metrics: async () => "",
};

export const metrics = {
  waQrCodesGenerated: counter(),
  waStateChanges: { labels: () => ({ inc: noop }) },
  waConsecutiveAuthFailures: { labels: () => ({ set: noop }) },
  inputValidationFailures: { labels: () => ({ inc: noop }) },
  waMessagesDropped: { labels: () => ({ inc: noop }) },
  waMessagesReceived: { labels: () => ({ inc: noop }) },
  waMessagesWithUrls: { labels: () => ({ inc: noop }) },
  ingestionRate: { inc: noop },
  urlsPerMessage: { observe: noop },
  waSessionState: { labels: () => ({ set: noop }) },
  waSessionReconnects: { labels: () => ({ inc: noop }) },
  waIncomingCalls: { labels: () => ({ inc: noop }) },
  waConsentGauge: { set: noop },
  waGovernanceActions: { labels: () => ({ inc: noop }) },
  waGroupEvents: { labels: () => ({ inc: noop }) },
  waMembershipApprovals: { labels: () => ({ inc: noop }) },
  waMessageEdits: { labels: () => ({ inc: noop }) },
  waVerdictFailures: { inc: noop },
  waVerdictAttachmentsSent: { labels: () => ({ inc: noop }) },
  waVerdictsSent: { inc: noop },
  waVerdictAckTimeouts: { labels: () => ({ inc: noop }) },
  waVerdictRetryAttempts: { labels: () => ({ inc: noop }) },
};

export const extractUrls = () => [] as string[];
export const normalizeUrl = (input: string) => input;
export const urlHash = (_: string) => "hash";
export const waSessionStatusGauge = { labels: () => ({ set: () => undefined }) };
export const isPrivateHostname = () => false;

export const ScanRequestSchema = { safeParse: (_: unknown) => ({ success: true, data: {} }) };

export const assertEssentialConfig = () => undefined;
export const assertControlPlaneToken = (): string =>
  (process.env.CONTROL_PLANE_API_TOKEN || "test-token").trim();
export const createRedisConnection = () => new (FakeRedis as any)();
export const connectRedis = async () => undefined;
