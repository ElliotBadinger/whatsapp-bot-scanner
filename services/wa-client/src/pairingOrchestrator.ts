type TimeoutHandle = NodeJS.Timeout;

export interface PairingOrchestratorOptions {
  enabled: boolean;
  forcePhonePairing: boolean;
  maxAttempts: number;
  baseRetryDelayMs: number;
  rateLimitDelayMs: number;
  requestCode: () => Promise<string>;
  onSuccess?: (code: string, attempt: number) => void;
  onError?: (err: unknown, attempt: number, nextDelayMs: number, meta: { rateLimited: boolean }) => void;
  onFallback?: (err: unknown, attempt: number) => void;
  onForcedRetry?: (err: unknown, attempt: number, nextDelayMs: number) => void;
  scheduler?: (fn: () => void, delay: number) => TimeoutHandle;
  clearer?: (handle: TimeoutHandle) => void;
}

export class PairingOrchestrator {
  private readonly forcePhonePairing: boolean;
  private readonly maxAttempts: number;
  private readonly baseRetryDelayMs: number;
  private readonly rateLimitDelayMs: number;
  private readonly requestCode: () => Promise<string>;
  private readonly onSuccess?: (code: string, attempt: number) => void;
  private readonly onError?: (err: unknown, attempt: number, nextDelayMs: number, meta: { rateLimited: boolean }) => void;
  private readonly onFallback?: (err: unknown, attempt: number) => void;
  private readonly onForcedRetry?: (err: unknown, attempt: number, nextDelayMs: number) => void;
  private readonly scheduler: (fn: () => void, delay: number) => TimeoutHandle;
  private readonly clearer: (handle: TimeoutHandle) => void;

  private enabled: boolean;
  private sessionActive = false;
  private codeDelivered = false;
  private attempts = 0;
  private timer: TimeoutHandle | null = null;

  constructor(options: PairingOrchestratorOptions) {
    this.enabled = options.enabled;
    this.forcePhonePairing = options.forcePhonePairing;
    this.maxAttempts = options.maxAttempts;
    this.baseRetryDelayMs = options.baseRetryDelayMs;
    this.rateLimitDelayMs = options.rateLimitDelayMs;
    this.requestCode = options.requestCode;
    this.onSuccess = options.onSuccess;
    this.onError = options.onError;
    this.onFallback = options.onFallback;
    this.onForcedRetry = options.onForcedRetry;
    this.scheduler = options.scheduler ?? ((fn, delay) => setTimeout(fn, delay));
    this.clearer = options.clearer ?? ((handle) => clearTimeout(handle));
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.cancel();
    }
  }

  setSessionActive(active: boolean): void {
    this.sessionActive = active;
    if (active) {
      this.cancel();
    }
  }

  setCodeDelivered(delivered: boolean): void {
    this.codeDelivered = delivered;
    if (delivered) {
      this.cancel();
    }
  }

  canSchedule(): boolean {
    return this.enabled && !this.sessionActive && !this.codeDelivered;
  }

  schedule(delayMs = 0): void {
    if (!this.canSchedule()) {
      return;
    }
    if (this.timer) {
      this.clearer(this.timer);
      this.timer = null;
    }
    const run = async () => {
      this.timer = null;
      if (!this.canSchedule()) {
        this.attempts = 0;
        return;
      }
      this.attempts += 1;
      try {
        const code = await this.requestCode();
        this.onSuccess?.(code, this.attempts);
        this.attempts = 0;
      } catch (err) {
        const attempt = this.attempts;
        const { rateLimited, delay } = this.classifyError(err);
        this.onError?.(err, attempt, delay, { rateLimited });
        if (this.forcePhonePairing && attempt >= this.maxAttempts) {
          this.onForcedRetry?.(err, attempt, delay);
          this.attempts = 0;
          if (this.canSchedule()) {
            this.schedule(delay);
          }
          return;
        }
        if (!this.forcePhonePairing && attempt >= this.maxAttempts) {
          this.cancel();
          this.onFallback?.(err, attempt);
          return;
        }
        if (this.canSchedule()) {
          this.schedule(delay);
        }
        return;
      }
    };

    this.timer = this.scheduler(() => {
      void run();
    }, Math.max(0, delayMs));
  }

  cancel(): void {
    if (this.timer) {
      this.clearer(this.timer);
      this.timer = null;
    }
    this.attempts = 0;
  }

  private classifyError(err: unknown): { rateLimited: boolean; delay: number } {
    const message = this.extractMessage(err);
    const rateLimited = message.includes('rate-overlimit') || message.includes('"code":429') || message.includes('429');
    const delay = rateLimited ? this.rateLimitDelayMs : this.baseRetryDelayMs;
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
}
