import Redis from 'ioredis';

export interface GroupGovernanceEvent {
  chatId: string;
  type: string;
  timestamp: number;
  actorId?: string | null;
  recipients?: string[];
  details?: string;
  metadata?: Record<string, unknown>;
}

export class GroupStore {
  private readonly maxEvents: number;

  constructor(private readonly redis: Redis, private readonly ttlSeconds: number, options?: { maxEvents?: number }) {
    this.maxEvents = options?.maxEvents && options.maxEvents > 0 ? options.maxEvents : 50;
  }

  private key(chatId: string): string {
    return `wa:group:audit:${chatId}`;
  }

  async recordEvent(event: GroupGovernanceEvent): Promise<void> {
    const payload: GroupGovernanceEvent = {
      ...event,
      recipients: event.recipients ?? [],
      metadata: event.metadata ?? {},
    };
    const serialized = JSON.stringify(payload);
    const key = this.key(event.chatId);
    await this.redis.lpush(key, serialized);
    await this.redis.ltrim(key, 0, this.maxEvents - 1);
    await this.redis.expire(key, this.ttlSeconds);
  }

  async listRecentEvents(chatId: string, limit = 10): Promise<GroupGovernanceEvent[]> {
    if (limit <= 0) {
      return [];
    }
    const entries = await this.redis.lrange(this.key(chatId), 0, limit - 1);
    const events: GroupGovernanceEvent[] = [];
    for (const entry of entries) {
      try {
        const parsed = JSON.parse(entry) as GroupGovernanceEvent;
        events.push(parsed);
      } catch {
        // ignore malformed entries
      }
    }
    return events;
  }

  async clearEvents(chatId: string): Promise<void> {
    await this.redis.del(this.key(chatId));
  }
}
