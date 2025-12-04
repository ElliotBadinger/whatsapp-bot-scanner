/**
 * In-memory Redis mock for testing purposes.
 * This class provides a minimal Redis-like interface for unit tests
 * without requiring a real Redis connection.
 */
export class InMemoryRedis {
  private store = new Map<string, string>();
  private ttlStore = new Map<string, number>();
  private setStore = new Map<string, Set<string>>();
  private hashStore = new Map<string, Map<string, string>>();
  private listStore = new Map<string, string[]>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(
    key: string,
    value: string,
    mode?: string,
    ttlArg?: number,
    nxArg?: string,
  ): Promise<"OK" | null> {
    if (mode === "EX") {
      const ttlSeconds = typeof ttlArg === "number" ? ttlArg : 0;
      if (nxArg === "NX" && this.store.has(key)) {
        return null;
      }
      this.store.set(key, value);
      if (ttlSeconds > 0) {
        this.ttlStore.set(key, ttlSeconds);
      } else {
        this.ttlStore.delete(key);
      }
      return "OK";
    }
    this.store.set(key, value);
    this.ttlStore.delete(key);
    return "OK";
  }

  async del(key: string): Promise<number> {
    const existed = this.store.delete(key);
    this.ttlStore.delete(key);
    this.setStore.delete(key);
    this.hashStore.delete(key);
    this.listStore.delete(key);
    return existed ? 1 : 0;
  }

  async ttl(key: string): Promise<number> {
    return this.ttlStore.get(key) ?? -1;
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (seconds > 0) {
      this.ttlStore.set(key, seconds);
      return 1;
    }
    this.ttlStore.delete(key);
    return 0;
  }

  async sadd(key: string, member: string): Promise<number> {
    const set = this.setStore.get(key) ?? new Set<string>();
    set.add(member);
    this.setStore.set(key, set);
    return set.size;
  }

  async srem(key: string, member: string): Promise<number> {
    const set = this.setStore.get(key);
    if (!set) return 0;
    const existed = set.delete(member);
    if (set.size === 0) this.setStore.delete(key);
    return existed ? 1 : 0;
  }

  async scard(key: string): Promise<number> {
    return this.setStore.get(key)?.size ?? 0;
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    const hash = this.hashStore.get(key) ?? new Map<string, string>();
    const existed = hash.has(field) ? 0 : 1;
    hash.set(field, value);
    this.hashStore.set(key, hash);
    return existed;
  }

  async hdel(key: string, field: string): Promise<number> {
    const hash = this.hashStore.get(key);
    if (!hash) return 0;
    const removed = hash.delete(field) ? 1 : 0;
    if (hash.size === 0) this.hashStore.delete(key);
    return removed;
  }

  async hkeys(key: string): Promise<string[]> {
    return Array.from(this.hashStore.get(key)?.keys() ?? []);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.hashStore.get(key)?.get(field) ?? null;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    const hash = this.hashStore.get(key);
    if (!hash) return {};
    return Object.fromEntries(hash.entries());
  }

  async lpush(key: string, value: string): Promise<number> {
    const list = this.listStore.get(key) ?? [];
    list.unshift(value);
    this.listStore.set(key, list);
    return list.length;
  }

  async ltrim(key: string, start: number, stop: number): Promise<void> {
    const list = this.listStore.get(key);
    if (!list) return;
    const normalizedStop = stop < 0 ? list.length + stop : stop;
    const trimmed = list.slice(start, normalizedStop + 1);
    this.listStore.set(key, trimmed);
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const list = this.listStore.get(key) ?? [];
    const normalizedStop = stop < 0 ? list.length + stop : stop;
    return list.slice(start, normalizedStop + 1);
  }

  async ping(): Promise<string> {
    return "PONG";
  }

  on(_event: string, _callback?: (...args: unknown[]) => void): void {
    // Intentionally no-op: event subscriptions are not required for in-memory Redis used in tests
  }

  quit(): Promise<void> {
    return Promise.resolve();
  }

  /** Clear all stored data - useful for test cleanup */
  clear(): void {
    this.store.clear();
    this.ttlStore.clear();
    this.setStore.clear();
    this.hashStore.clear();
    this.listStore.clear();
  }
}
