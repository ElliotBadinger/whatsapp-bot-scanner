export default class FakeRedis {
  private store = new Map<string, { value: string; expiresAt?: number }>();
  private hashes = new Map<string, Map<string, string>>();
  private sets = new Map<string, Set<string>>();
  private lists = new Map<string, string[]>();
  private sortedSets = new Map<string, Map<string, number>>();

  async ping() {
    return 'PONG';
  }

  private cleanup(key: string) {
    const entry = this.store.get(key);
    if (entry?.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key);
    }
  }

  async get(key: string) {
    this.cleanup(key);
    return this.store.get(key)?.value ?? null;
  }

  async set(key: string, value: string, mode?: string, ttl?: number, option?: string) {
    let expiresAt: number | undefined;
    let useNx = false;
    if (mode === 'EX' && typeof ttl === 'number') {
      expiresAt = Date.now() + ttl * 1000;
      if (option === 'NX') {
        useNx = true;
      }
    } else if (mode === 'EX' && option === 'NX' && typeof ttl === 'string') {
      expiresAt = Date.now() + Number.parseInt(ttl, 10) * 1000;
      useNx = true;
    }
    if (useNx && this.store.has(key)) {
      return null;
    }
    this.store.set(key, { value, expiresAt });
    return 'OK';
  }

  async expire(key: string, ttlSeconds: number) {
    const existing = this.store.get(key);
    if (existing) {
      existing.expiresAt = Date.now() + ttlSeconds * 1000;
      this.store.set(key, existing);
    }
  }

  async del(key: string) {
    this.store.delete(key);
    this.hashes.delete(key);
    this.sets.delete(key);
    this.lists.delete(key);
    this.sortedSets.delete(key);
  }

  async hset(key: string, field: string, value: string) {
    const map = this.hashes.get(key) ?? new Map<string, string>();
    map.set(field, value);
    this.hashes.set(key, map);
  }

  async hkeys(key: string) {
    return Array.from(this.hashes.get(key)?.keys() ?? []);
  }

  async hdel(key: string, field: string) {
    this.hashes.get(key)?.delete(field);
  }

  async sadd(key: string, member: string) {
    const set = this.sets.get(key) ?? new Set<string>();
    set.add(member);
    this.sets.set(key, set);
  }

  async srem(key: string, member: string) {
    this.sets.get(key)?.delete(member);
  }

  async scard(key: string) {
    return (this.sets.get(key)?.size ?? 0);
  }

  async lpush(key: string, value: string) {
    const list = this.lists.get(key) ?? [];
    list.unshift(value);
    this.lists.set(key, list);
  }

  async ltrim(key: string, start: number, stop: number) {
    const list = this.lists.get(key) ?? [];
    const end = stop >= 0 ? stop + 1 : list.length + stop + 1;
    this.lists.set(key, list.slice(start, end));
  }

  async lrange(key: string, start: number, stop: number) {
    const list = this.lists.get(key) ?? [];
    const end = stop >= 0 ? stop + 1 : list.length + stop + 1;
    return list.slice(start, end);
  }

  async zadd(key: string, score: number, member: string) {
    const set = this.sortedSets.get(key) ?? new Map<string, number>();
    set.set(member, score);
    this.sortedSets.set(key, set);
    return 1;
  }

  async zrange(key: string, start: number, stop: number) {
    const set = this.sortedSets.get(key);
    if (!set) return [];
    const entries = Array.from(set.entries()).sort((a, b) => a[1] - b[1]);
    const end = stop >= 0 ? stop + 1 : entries.length + stop + 1;
    return entries.slice(start, end).map(([member]) => member);
  }

  async zrem(key: string, member: string) {
    this.sortedSets.get(key)?.delete(member);
  }
}
