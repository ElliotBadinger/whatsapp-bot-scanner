export enum CircuitState {
  CLOSED = 0,
  OPEN = 1,
  HALF_OPEN = 2,
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  successThreshold: number;
  timeoutMs: number;
  windowMs: number;
  name: string;
  onStateChange?: (state: CircuitState, from: CircuitState) => void;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number[] = [];
  private successes: number = 0;
  private lastAttempt = 0;

  constructor(private readonly options: CircuitBreakerOptions) {}

  getState() {
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    this.trimFailures(now);
    switch (this.state) {
      case CircuitState.OPEN:
        if (now - this.lastAttempt < this.options.timeoutMs) {
          throw new Error(`Circuit ${this.options.name} is open`);
        }
        this.changeState(CircuitState.HALF_OPEN);
        break;
      case CircuitState.HALF_OPEN:
        // allow single test request
        break;
      case CircuitState.CLOSED:
      default:
        break;
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (err) {
      this.recordFailure(now);
      throw err;
    }
  }

  private trimFailures(now: number) {
    const threshold = now - this.options.windowMs;
    this.failures = this.failures.filter(ts => ts > threshold);
  }

  private recordFailure(now: number) {
    this.failures.push(now);
    this.lastAttempt = now;
    if (this.state === CircuitState.HALF_OPEN) {
      this.changeState(CircuitState.OPEN);
      this.successes = 0;
    } else if (this.failures.length >= this.options.failureThreshold && this.state === CircuitState.CLOSED) {
      this.changeState(CircuitState.OPEN);
    }
  }

  private recordSuccess() {
    this.successes += 1;
    if (this.state === CircuitState.HALF_OPEN && this.successes >= this.options.successThreshold) {
      this.changeState(CircuitState.CLOSED);
      this.successes = 0;
      this.failures = [];
    } else if (this.state === CircuitState.CLOSED) {
      this.failures = [];
    }
  }

  private changeState(next: CircuitState) {
    const prev = this.state;
    this.state = next;
    if (this.options.onStateChange) {
      this.options.onStateChange(next, prev);
    }
  }
}

export async function withRetry<T>(
  task: () => Promise<T>,
  options: { retries: number; baseDelayMs: number; factor?: number; retryable?: (err: unknown) => boolean } = { retries: 0, baseDelayMs: 0 }
): Promise<T> {
  const factor = options.factor ?? 2;
  let attempt = 0;
  while (true) {
    try {
      return await task();
    } catch (err) {
      attempt += 1;
      const shouldRetry =
        attempt <= options.retries &&
        (!options.retryable || options.retryable(err));
      if (!shouldRetry) {
        throw err;
      }
      const delay = options.baseDelayMs * Math.pow(factor, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
