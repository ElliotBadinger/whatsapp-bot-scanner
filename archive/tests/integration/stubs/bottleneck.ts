type Task<T> = () => Promise<T>;

const instances: any[] = [];

type QueueEntry<T> = {
  task: Task<T>;
  resolve: (value: T) => void;
  reject: (err: unknown) => void;
};

class FakeLimiter {
  private handlers: Record<string, ((...args: any[]) => void) | undefined> = {};
  private queue: QueueEntry<any>[] = [];
  reservoir: number;
  private readonly refreshAmount: number;
  private readonly refreshInterval?: number;
  private intervalRef?: NodeJS.Timeout;

  constructor(
    options: {
      reservoir?: number;
      reservoirRefreshAmount?: number;
      reservoirRefreshInterval?: number;
    } = {},
  ) {
    const defaultReservoir = options.reservoir ?? Number.POSITIVE_INFINITY;
    this.reservoir = defaultReservoir;
    this.refreshAmount = options.reservoirRefreshAmount ?? this.reservoir;
    this.refreshInterval = options.reservoirRefreshInterval;
    instances.push(this);

    if (this.refreshInterval && Number.isFinite(this.refreshInterval)) {
      this.intervalRef = setInterval(() => {
        void this.incrementReservoir();
      }, this.refreshInterval);
      if (typeof this.intervalRef.unref === "function") {
        this.intervalRef.unref();
      }
    }
  }

  on(event: string, handler: (...args: any[]) => void) {
    this.handlers[event] = handler;
  }

  async schedule<T>(task: Task<T>): Promise<T> {
    if (this.reservoir <= 0) {
      return new Promise<T>((resolve, reject) => {
        this.queue.push({ task, resolve, reject });
      });
    }
    this.reservoir -= 1;
    try {
      const result = await task();
      return result;
    } finally {
      if (this.reservoir <= 0) {
        this.handlers["depleted"]?.();
      }
    }
  }

  async currentReservoir(): Promise<number> {
    return this.reservoir;
  }

  async incrementReservoir(amount?: number) {
    this.reservoir += amount ?? this.refreshAmount;
    this.flush();
  }

  release(amount = this.refreshAmount) {
    this.reservoir = amount;
    this.flush();
  }

  private flush() {
    while (this.reservoir > 0 && this.queue.length > 0) {
      const entry = this.queue.shift();
      if (!entry) break;
      this.schedule(entry.task).then(entry.resolve, entry.reject);
    }
  }

  getQueueLength() {
    return this.queue.length;
  }

  queued() {
    return this.queue.length;
  }
}

export { instances as __instances };
export default FakeLimiter;
