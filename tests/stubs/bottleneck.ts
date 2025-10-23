export default class MockBottleneck {
  constructor(public options: Record<string, unknown> = {}) {}

  // mimic reservoir tracking
  private reservoir = Number.isFinite(this.options?.reservoir as number)
    ? Number(this.options?.reservoir)
    : 1000;

  on(_event: string, _listener: (..._args: any[]) => void): void {
    // no-op in tests
  }

  async schedule<T>(task: () => Promise<T> | T): Promise<T> {
    return Promise.resolve().then(task as () => Promise<T>);
  }

  async currentReservoir(): Promise<number> {
    return this.reservoir;
  }
}
