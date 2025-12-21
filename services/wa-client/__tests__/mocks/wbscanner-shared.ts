import FakeRedis from "../../src/__tests__/fake-redis";

const noop = () => undefined;
const counter = () => ({ inc: noop, labels: () => ({ inc: noop }) });
const gauge = () => ({ set: noop, labels: () => ({ set: noop }) });
const histogram = () => ({ observe: noop, labels: () => ({ observe: noop }) });

export const config = {
  queues: {
    scanRequest: "scan-request",
    scanVerdict: "scan-verdict",
  },
  features: {
    attachMediaToVerdicts: true,
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
    verdictAckTimeoutSeconds: 30,
    globalRatePerHour: 1000,
    globalTokenBucketKey: "wa:global",
    perGroupCooldownSeconds: 2,
    perGroupHourlyLimit: 100,
    governanceInterventionsPerHour: 25,
    membershipAutoApprovePerHour: 25,
    membershipGlobalHourlyLimit: 200,
    membershipAutoApproveEnabled: true,
    headless: true,
    puppeteerArgs: [],
    remoteAuth: {
      store: "redis",
      clientId: "default",
      phoneNumber: "",
      dataKey: "",
      phoneNumbers: ["15551234567"],
      disableQrFallback: false,
      forceNewSession: false,
      autoPair: true,
      maxPairingRetries: 3,
      pairingRetryDelayMs: 15000,
      pollingEnabled: false,
      pairingDelayMs: 0,
      parallelCheckTimeoutMs: 5000,
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
  waVerdictAckTransitions: { labels: () => ({ inc: noop }) },
  waVerdictLatency: histogram(),
  waMessageReactions: { labels: () => ({ inc: noop }) },
  waMessageRevocations: { labels: () => ({ inc: noop }) },
  waResponseLatency: histogram(),
  queueJobWait: histogram(),
  queueProcessingDuration: histogram(),
  queueCompleted: { labels: () => ({ inc: noop }) },
  queueRetries: { labels: () => ({ inc: noop }) },
  queueFailures: { labels: () => ({ inc: noop }) },
};

let extractUrlsImpl = (_: string) => [] as string[];
export const __setExtractUrls = (fn: (input: string) => string[]) => {
  extractUrlsImpl = fn;
};
export const extractUrls = (input: string) => extractUrlsImpl(input);

let normalizeUrlImpl = (input: string) => input;
export const __setNormalizeUrl = (fn: (input: string) => string) => {
  normalizeUrlImpl = fn;
};
export const normalizeUrl = (input: string) => normalizeUrlImpl(input);
export const urlHash = (input: string) => `hash:${input}`;
export const waSessionStatusGauge = {
  labels: () => ({ set: () => undefined }),
};
let privateHostResult = false;
export const __setPrivateHostnameResult = (value: boolean) => {
  privateHostResult = value;
};
export const isPrivateHostname = async () => privateHostResult;

export const ScanRequestSchema = {
  safeParse: (input: unknown) => ({ success: true, data: input }),
  parse: (input: unknown) => input,
};

export const assertEssentialConfig = () => undefined;
export const assertControlPlaneToken = (): string =>
  (process.env.CONTROL_PLANE_API_TOKEN || "test-token").trim();
export const createRedisConnection = () => new (FakeRedis as any)();
export const connectRedis = async () => undefined;

export const hashChatId = (input: string) => input;
export const hashMessageId = (input: string) => input;
export const isIdentifierHash = () => false;

export class InMemoryRedis extends FakeRedis {}
