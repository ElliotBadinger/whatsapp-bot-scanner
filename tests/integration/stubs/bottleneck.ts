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

  constructor(options: { reservoir?: number; reservoirRefreshAmount?: number } = {}) {
    this.reservoir = options.reservoir ?? 0;
    this.refreshAmount = options.reservoirRefreshAmount ?? this.reservoir;
    instances.push(this);
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
        this.handlers['depleted']?.();
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
}

export { instances as __instances };
export default FakeLimiter;
