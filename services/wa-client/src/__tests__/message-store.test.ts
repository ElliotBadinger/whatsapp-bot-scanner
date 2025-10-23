import FakeRedis from './fake-redis';
import { MessageStore, VerdictContext } from '../message-store';

function createStore(ttl = 60) {
  const redis = new FakeRedis();
  const store = new MessageStore(redis as unknown as any, ttl);
  return { store, redis };
}

describe('MessageStore ack persistence', () => {
  it('persists pending ack contexts', async () => {
    const { store } = createStore();
    const contextA: VerdictContext = { chatId: 'chat-1', messageId: 'msg-1', urlHash: 'hash-1' };
    const contextB: VerdictContext = { chatId: 'chat-1', messageId: 'msg-2', urlHash: 'hash-2' };

    await store.addPendingAckContext(contextA);
    await store.addPendingAckContext(contextB);

    const contexts = await store.listPendingAckContexts(10);
    expect(contexts).toEqual(expect.arrayContaining([contextA, contextB]));

    await store.removePendingAckContext(contextA);
    const remaining = await store.listPendingAckContexts(10);
    expect(remaining).toEqual(expect.arrayContaining([contextB]));
    expect(remaining).toHaveLength(1);
  });

  it('stores retry metadata for verdict attempts', async () => {
    const { store } = createStore();
    const payload = {
      chatId: 'chat-2',
      messageId: 'msg-3',
      url: 'https://example.com',
      urlHash: 'hash-3',
      verdict: 'malicious',
      reasons: ['phishing'],
      redirectChain: ['https://redirect'],
      shortener: { provider: 'tiny', chain: ['https://tinyurl', 'https://example.com'] },
    };

    await store.registerVerdictAttempt(payload);
    const record = await store.getVerdictRecord({ chatId: payload.chatId, messageId: payload.messageId, urlHash: payload.urlHash });

    expect(record?.redirectChain).toEqual(payload.redirectChain);
    expect(record?.shortener).toEqual(payload.shortener);
  });
});
