/**
 * In-memory Redis mock for testing purposes.
 * This class provides a minimal Redis-like interface for unit tests
 * without requiring a real Redis connection.
 */
export class InMemoryRedis {
  private readonly store = new Map<string, string>();
  private readonly ttlStore = new Map<string, number>();
  private readonly setStore = new Map<string, Set<string>>();
  private readonly hashStore = new Map<string, Map<string, string>>();
  private readonly listStore = new Map<string, string[]>();

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

  async sadd(key: string, ...members: string[]): Promise<number> {
    const set = this.setStore.get(key) ?? new Set<string>();
    let added = 0;
    for (const member of members) {
      if (!set.has(member)) {
        set.add(member);
        added++;
      }
    }
    this.setStore.set(key, set);
    return added;
  }

  async smembers(key: string): Promise<string[]> {
    const set = this.setStore.get(key);
    return set ? Array.from(set) : [];
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

  async lpush(key: string, ...values: string[]): Promise<number> {
    const list = this.listStore.get(key) ?? [];
    const reversed = [...values].reverse();
    for (const value of reversed) {
      list.unshift(value);
    }
    this.listStore.set(key, list);
    return list.length;
  }

  async rpush(key: string, ...values: string[]): Promise<number> {
    const list = this.listStore.get(key) ?? [];
    list.push(...values);
    this.listStore.set(key, list);
    return list.length;
  }

  async lpop(key: string): Promise<string | null> {
    const list = this.listStore.get(key);
    if (!list || list.length === 0) return null;
    return list.shift() ?? null;
  }

  async rpop(key: string): Promise<string | null> {
    const list = this.listStore.get(key);
    if (!list || list.length === 0) return null;
    return list.pop() ?? null;
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

  async exists(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (
        this.store.has(key) ||
        this.hashStore.has(key) ||
        this.listStore.has(key) ||
        this.setStore.has(key)
      ) {
        count++;
      }
    }
    return count;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(
      "^" + pattern.replaceAll("*", ".*").replaceAll("?", ".") + "$",
    );
    const allKeys = [
      ...this.store.keys(),
      ...this.hashStore.keys(),
      ...this.listStore.keys(),
      ...this.setStore.keys(),
    ];
    return [...new Set(allKeys)].filter((k) => regex.test(k));
  }

  async incr(key: string): Promise<number> {
    const current = Number.parseInt(this.store.get(key) ?? "0", 10);
    const next = current + 1;
    this.store.set(key, String(next));
    return next;
  }

  async decr(key: string): Promise<number> {
    const current = Number.parseInt(this.store.get(key) ?? "0", 10);
    const next = current - 1;
    this.store.set(key, String(next));
    return next;
  }

  async incrby(key: string, increment: number): Promise<number> {
    const current = Number.parseInt(this.store.get(key) ?? "0", 10);
    const next = current + increment;
    this.store.set(key, String(next));
    return next;
  }

  async setex(key: string, seconds: number, value: string): Promise<string> {
    this.store.set(key, value);
    this.ttlStore.set(key, seconds);
    return "OK";
  }

  async setnx(key: string, value: string): Promise<number> {
    if (this.store.has(key)) return 0;
    this.store.set(key, value);
    return 1;
  }

  async hmset(key: string, data: Record<string, string>): Promise<string> {
    const hash = this.hashStore.get(key) ?? new Map<string, string>();
    for (const [field, value] of Object.entries(data)) {
      hash.set(field, value);
    }
    this.hashStore.set(key, hash);
    return "OK";
  }

  private readonly zsetStore = new Map<string, Map<string, number>>();

  async zadd(key: string, score: number, member: string): Promise<number> {
    const zset = this.zsetStore.get(key) ?? new Map<string, number>();
    const isNew = !zset.has(member);
    zset.set(member, score);
    this.zsetStore.set(key, zset);
    return isNew ? 1 : 0;
  }

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    const zset = this.zsetStore.get(key);
    if (!zset) return [];
    const sorted = Array.from(zset.entries()).sort((a, b) => a[1] - b[1]);
    const normalizedStop = stop < 0 ? sorted.length + stop : stop;
    return sorted.slice(start, normalizedStop + 1).map(([member]) => member);
  }

  async zrem(key: string, ...members: string[]): Promise<number> {
    const zset = this.zsetStore.get(key);
    if (!zset) return 0;
    let removed = 0;
    for (const member of members) {
      if (zset.delete(member)) removed++;
    }
    if (zset.size === 0) this.zsetStore.delete(key);
    return removed;
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
