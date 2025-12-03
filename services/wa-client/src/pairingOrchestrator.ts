type TimeoutHandle = NodeJS.Timeout;

export interface PairingErrorInfo {
  type: 'rate_limit' | 'network' | 'other';
  retryAfter: number;
  message: string;
  rawError: unknown;
}

export interface PairingStatus {
  canRequest: boolean;
  rateLimited: boolean;
  nextAttemptIn: number;
  lastAttemptAt: number | null;
  consecutiveRateLimits: number;
}

export interface PairingOrchestratorOptions {
  enabled: boolean;
  forcePhonePairing: boolean;
  maxAttempts: number;
  baseRetryDelayMs: number;
  rateLimitDelayMs: number;
  maxRateLimitDelayMs?: number;
  manualOnly?: boolean;
  requestCode: () => Promise<string>;
  onSuccess?: (code: string, attempt: number) => void;
  onError?: (err: unknown, attempt: number, nextDelayMs: number, meta: { rateLimited: boolean; holdUntil?: number }, errorInfo?: PairingErrorInfo) => void;
  onFallback?: (err: unknown, attempt: number) => void;
  onForcedRetry?: (err: unknown, attempt: number, nextDelayMs: number, meta: { rateLimited: boolean; holdUntil?: number }, errorInfo?: PairingErrorInfo) => void;
  scheduler?: (fn: () => void, delay: number) => TimeoutHandle;
  clearer?: (handle: TimeoutHandle) => void;
  storage?: {
    get: () => Promise<string | null>;
    set: (val: string) => Promise<void>;
  };
}

export class PairingOrchestrator {
  private readonly forcePhonePairing: boolean;
  private readonly maxAttempts: number;
  private readonly baseRetryDelayMs: number;
  private readonly rateLimitDelayMs: number;
  private readonly maxRateLimitDelayMs: number;
  private readonly manualOnly: boolean;
  private readonly requestCode: () => Promise<string>;
  private readonly onSuccess?: (code: string, attempt: number) => void;
  private readonly onError?: (err: unknown, attempt: number, nextDelayMs: number, meta: { rateLimited: boolean; holdUntil?: number }, errorInfo?: PairingErrorInfo) => void;
  private readonly onFallback?: (err: unknown, attempt: number) => void;
  private readonly onForcedRetry?: (err: unknown, attempt: number, nextDelayMs: number, meta: { rateLimited: boolean; holdUntil?: number }, errorInfo?: PairingErrorInfo) => void;
  private readonly scheduler: (fn: () => void, delay: number) => TimeoutHandle;
  private readonly clearer: (handle: TimeoutHandle) => void;
  private readonly storage?: {
    get: () => Promise<string | null>;
    set: (val: string) => Promise<void>;
  };

  private enabled: boolean;
  private sessionActive = false;
  private codeDelivered = false;
  private attempts = 0;
  private timer: TimeoutHandle | null = null;
  private consecutiveRateLimit = 0;
  private lastAttemptAt: number | null = null;
  private nextAllowedAttemptAt: number | null = null;

  constructor(options: PairingOrchestratorOptions) {
    this.enabled = options.enabled;
    this.forcePhonePairing = options.forcePhonePairing;
    this.maxAttempts = options.maxAttempts;
    this.baseRetryDelayMs = options.baseRetryDelayMs;
    this.rateLimitDelayMs = options.rateLimitDelayMs;
    const configuredMaxRateDelay = options.maxRateLimitDelayMs ?? Math.max(options.rateLimitDelayMs * 10, 15 * 60 * 1000);
    this.maxRateLimitDelayMs = Math.max(options.rateLimitDelayMs, configuredMaxRateDelay);
    this.manualOnly = options.manualOnly ?? false;
    this.requestCode = options.requestCode;
    this.onSuccess = options.onSuccess;
    this.onError = options.onError;
    this.onFallback = options.onFallback;
    this.onForcedRetry = options.onForcedRetry;
    this.scheduler = options.scheduler ?? ((fn, delay) => setTimeout(fn, delay));
    this.clearer = options.clearer ?? ((handle) => clearTimeout(handle));
    this.storage = options.storage;
  }

  async init(): Promise<void> {
    if (this.storage) {
      await this.loadState();
    }
  }

  private async loadState(): Promise<void> {
    if (!this.storage) return;
    try {
      const raw = await this.storage.get();
      if (raw) {
        const parsed = Number(raw);
        if (Number.isFinite(parsed) && parsed > Date.now()) {
          this.nextAllowedAttemptAt = parsed;
          // If we have a future timestamp, we are effectively rate limited or in backoff
          // We can't know the exact consecutive count, but we should respect the wait
          this.consecutiveRateLimit = 1;
        }
      }
    } catch {
      // ignore storage errors
    }
  }

  private async saveState(): Promise<void> {
    if (!this.storage) return;
    try {
      if (this.nextAllowedAttemptAt) {
        await this.storage.set(String(this.nextAllowedAttemptAt));
      } else {
        // If no restriction, we could clear it, but the interface is simple set/get
        // Maybe set to 0 or past
        await this.storage.set('0');
      }
    } catch {
      // ignore storage errors
    }
  }

  async setEnabled(enabled: boolean): Promise<void> {
    this.enabled = enabled;
    if (!enabled) {
      await this.cancel();
    }
  }

  async setSessionActive(active: boolean): Promise<void> {
    this.sessionActive = active;
    if (active) {
      await this.cancel();
    }
  }

  async setCodeDelivered(delivered: boolean): Promise<void> {
    this.codeDelivered = delivered;
    if (delivered) {
      await this.cancel();
    }
  }

  canSchedule(): boolean {
    if (this.manualOnly) {
      return false; // Manual mode: prevent automatic scheduling
    }
    return this.enabled && !this.sessionActive && !this.codeDelivered;
  }

  /**
   * Get time remaining until next allowed pairing attempt (in milliseconds).
   * Returns 0 if an attempt can be made immediately.
   */
  getRemainingCooldown(): number {
    if (!this.nextAllowedAttemptAt) {
      return 0;
    }
    const remaining = this.nextAllowedAttemptAt - Date.now();
    return Math.max(0, remaining);
  }

  /**
   * Get current pairing status for display/decision-making.
   */
  getStatus(): PairingStatus {
    const cooldown = this.getRemainingCooldown();
    const canRequest = this.enabled && !this.sessionActive && !this.codeDelivered && cooldown === 0;

    return {
      canRequest,
      rateLimited: this.consecutiveRateLimit > 0,
      nextAttemptIn: cooldown,
      lastAttemptAt: this.lastAttemptAt,
      consecutiveRateLimits: this.consecutiveRateLimit,
    };
  }

  /**
   * Manually trigger a pairing code request (for manual-only mode).
   * Returns true if request was scheduled, false if blocked by cooldown/state.
   */
  requestManually(): boolean {
    if (!this.enabled || this.sessionActive || this.codeDelivered) {
      return false;
    }

    const cooldown = this.getRemainingCooldown();
    if (cooldown > 0) {
      return false; // Still in cooldown
    }

    this.schedule(0);
    return true;
  }

  schedule(delayMs = 0): void {
    if (!this.manualOnly && !this.canSchedule()) {
      return;
    }
    // In manual mode, allow scheduling even when canSchedule returns false
    // (as long as session isn't active and code not delivered)
    if (this.manualOnly && (this.sessionActive || this.codeDelivered)) {
      return;
    }

    if (this.timer) {
      this.clearer(this.timer);
      this.timer = null;
    }
    const run = async () => {
      this.timer = null;
      if (!this.manualOnly && !this.canSchedule()) {
        this.attempts = 0;
        return;
      }
      if (this.manualOnly && (this.sessionActive || this.codeDelivered)) {
        this.attempts = 0;
        return;
      }

      this.attempts += 1;
      this.lastAttemptAt = Date.now();
      try {
        const code = await this.requestCode();
        this.nextAllowedAttemptAt = null;
        this.consecutiveRateLimit = 0;
        void this.saveState(); // Clear backoff on success (fire-and-forget)
        this.onSuccess?.(code, this.attempts);
        this.attempts = 0;
      } catch (err) {
        const attempt = this.attempts;
        const { rateLimited, delay } = this.classifyError(err, attempt);
        if (rateLimited) {
          this.consecutiveRateLimit += 1;
          this.nextAllowedAttemptAt = Date.now() + delay;
        } else {
          this.consecutiveRateLimit = 0;
          this.nextAllowedAttemptAt = null;
        }
        void this.saveState(); // Persist the new backoff state

        const holdUntil = rateLimited ? Date.now() + delay : undefined;
        const errorInfo = this.createErrorInfo(err, rateLimited, delay);
        this.onError?.(err, attempt, delay, { rateLimited, holdUntil }, errorInfo);
        if (this.forcePhonePairing && attempt >= this.maxAttempts) {
          this.onForcedRetry?.(err, attempt, delay, { rateLimited, holdUntil }, errorInfo);
          this.attempts = 0;
          if (!this.manualOnly && this.canSchedule()) {
            this.schedule(delay);
          }
          return;
        }
        if (!this.forcePhonePairing && attempt >= this.maxAttempts) {
          await this.cancel();
          this.onFallback?.(err, attempt);
          return;
        }
        if (!this.manualOnly && this.canSchedule()) {
          this.schedule(delay);
        }
        return;
      }
    };

    this.timer = this.scheduler(() => {
      void run();
    }, Math.max(0, delayMs));
  }

  async cancel(): Promise<void> {
    if (this.timer) {
      this.clearer(this.timer);
      this.timer = null;
    }
    this.attempts = 0;
    this.consecutiveRateLimit = 0;
    this.nextAllowedAttemptAt = null;
    await this.saveState();
  }

  private classifyError(err: unknown, attempt: number): { rateLimited: boolean; delay: number } {
    const message = this.extractMessage(err);
    const rateLimited = message.includes('rate-overlimit') || message.includes('"code":429') || message.includes('429');
    if (rateLimited) {
      const exponent = Math.min(Math.max(0, attempt - 1), 5);
      const multiplier = Math.pow(2, exponent);
      const delay = Math.min(this.rateLimitDelayMs * multiplier, this.maxRateLimitDelayMs);
      return { rateLimited, delay };
    }
    const backoffExponent = Math.min(Math.max(0, attempt - 1), 3);
    const delay = Math.min(this.baseRetryDelayMs * Math.max(1, Math.pow(2, backoffExponent)), this.rateLimitDelayMs);
    return { rateLimited, delay };
  }

  private extractMessage(err: unknown): string {
    if (err instanceof Error) {
      return err.message ?? '';
    }
    if (typeof err === 'string') {
      return err;
    }
    try {
      return JSON.stringify(err);
    } catch {
      return '';
    }
  }

  private createErrorInfo(err: unknown, rateLimited: boolean, retryAfter: number): PairingErrorInfo {
    const message = this.extractMessage(err);
    let type: 'rate_limit' | 'network' | 'other' = 'other';

    if (rateLimited) {
      type = 'rate_limit';
    } else if (message.includes('network') || message.includes('timeout') || message.includes('ECONNREFUSED')) {
      type = 'network';
    }

    return {
      type,
      retryAfter,
      message,
      rawError: err,
    };
  }
}
