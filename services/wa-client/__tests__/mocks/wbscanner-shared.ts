import FakeRedis from "../../src/__tests__/fake-redis";
import crypto from "node:crypto";

export class InMemoryRedis {
  private readonly store = new Map<string, string>();
  private readonly hashStore = new Map<string, Map<string, string>>();
  private readonly ttlStore = new Map<string, number>();

  async hset(
    key: string,
    fieldOrData: string | Record<string, string>,
    value?: string,
  ): Promise<number> {
    const hash = this.hashStore.get(key) ?? new Map<string, string>();
    let added = 0;

    if (typeof fieldOrData === "object") {
      for (const [field, val] of Object.entries(fieldOrData)) {
        if (!hash.has(field)) added++;
        hash.set(field, val);
      }
    } else if (value !== undefined) {
      if (!hash.has(fieldOrData)) added = 1;
      hash.set(fieldOrData, value);
    }

    this.hashStore.set(key, hash);
    return added;
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.hashStore.get(key)?.get(field) ?? null;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    const hash = this.hashStore.get(key);
    if (!hash) return {};
    return Object.fromEntries(hash.entries());
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (seconds > 0) {
      this.ttlStore.set(key, seconds);
      return 1;
    }
    this.ttlStore.delete(key);
    return 0;
  }

  async del(key: string): Promise<number> {
    const existed =
      this.store.delete(key) ||
      this.hashStore.delete(key) ||
      this.ttlStore.delete(key);
    return existed ? 1 : 0;
  }
}

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

export function isIdentifierHash(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

function digest(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function hashChatId(chatId: string): string {
  return digest(`chat:${chatId}`);
}

export function hashMessageId(messageId: string): string {
  return digest(`msg:${messageId}`);
}

export function hashIdentifierPair(chatId: string, messageId: string): string {
  return digest(`pair:${chatId}:${messageId}`);
}
