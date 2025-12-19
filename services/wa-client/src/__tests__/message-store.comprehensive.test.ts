import FakeRedis from './fake-redis';
import { MessageStore, VerdictContext, MessageRecord, VerdictAttemptPayload } from '../message-store';

function createStore(ttl = 60) {
  const redis = new FakeRedis();
  const store = new MessageStore(redis as unknown as any, ttl);
  return { store, redis };
}

describe('MessageStore', () => {
  describe('getRecord / setRecord', () => {
    it('stores and retrieves message records', async () => {
      const { store } = createStore();
      const record: MessageRecord = {
        chatId: 'chat-1',
        messageId: 'msg-1',
        senderId: 'user-1',
        senderIdHash: 'hash-user-1',
        timestamp: Date.now(),
        body: 'Hello world',
        normalizedUrls: ['https://example.com/'],
        urlHashes: ['abc123'],
        createdAt: Date.now(),
        edits: [],
        reactions: [],
        revocations: [],
        verdicts: {},
      };

      await store.setRecord(record);
      const retrieved = await store.getRecord('chat-1', 'msg-1');
      
      expect(retrieved).not.toBeNull();
      expect(retrieved?.chatId).toBe('chat-1');
      expect(retrieved?.messageId).toBe('msg-1');
      expect(retrieved?.body).toBe('Hello world');
    });

    it('returns null for non-existent records', async () => {
      const { store } = createStore();
      const result = await store.getRecord('nonexistent', 'also-nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('ensureRecord', () => {
    it('creates new record if not exists', async () => {
      const { store } = createStore();
      const record = await store.ensureRecord({
        chatId: 'chat-2',
        messageId: 'msg-2',
        senderId: 'user-2',
      });

      expect(record.chatId).toBe('chat-2');
      expect(record.messageId).toBe('msg-2');
      expect(record.edits).toEqual([]);
      expect(record.reactions).toEqual([]);
      expect(record.revocations).toEqual([]);
      expect(record.verdicts).toEqual({});
    });

    it('returns existing record without modifying', async () => {
      const { store } = createStore();
      const original = await store.ensureRecord({
        chatId: 'chat-3',
        messageId: 'msg-3',
        body: 'original body',
      });

      const second = await store.ensureRecord({
        chatId: 'chat-3',
        messageId: 'msg-3',
        body: 'new body should be ignored',
      });

      expect(second.body).toBe('original body');
      expect(second.createdAt).toBe(original.createdAt);
    });
  });

  describe('recordMessageCreate', () => {
    it('creates message with URLs and hashes', async () => {
      const { store } = createStore();
      const record = await store.recordMessageCreate({
        chatId: 'chat-4',
        messageId: 'msg-4',
        senderId: 'user-4',
        senderIdHash: 'hash-4',
        timestamp: 1700000000000,
        body: 'Check this: https://example.com',
        normalizedUrls: ['https://example.com/'],
        urlHashes: ['hash123'],
      });

      expect(record.normalizedUrls).toEqual(['https://example.com/']);
      expect(record.urlHashes).toEqual(['hash123']);
      expect(record.timestamp).toBe(1700000000000);
    });

    it('updates existing record with new data', async () => {
      const { store } = createStore();
      await store.ensureRecord({
        chatId: 'chat-5',
        messageId: 'msg-5',
      });

      const updated = await store.recordMessageCreate({
        chatId: 'chat-5',
        messageId: 'msg-5',
        body: 'Updated body',
        normalizedUrls: ['https://new.com/'],
        urlHashes: ['newhash'],
      });

      expect(updated.body).toBe('Updated body');
      expect(updated.normalizedUrls).toEqual(['https://new.com/']);
    });
  });

  describe('appendEdit', () => {
    it('appends edit to existing record', async () => {
      const { store } = createStore();
      await store.recordMessageCreate({
        chatId: 'chat-6',
        messageId: 'msg-6',
        body: 'Original',
        normalizedUrls: [],
        urlHashes: [],
      });

      const edit = {
        body: 'Edited message',
        normalizedUrls: ['https://newurl.com/'],
        urlHashes: ['edithash'],
        timestamp: Date.now(),
      };

      const result = await store.appendEdit('chat-6', 'msg-6', edit);
      
      expect(result).not.toBeNull();
      expect(result?.body).toBe('Edited message');
      expect(result?.edits).toHaveLength(1);
      expect(result?.edits[0].body).toBe('Edited message');
    });

    it('returns null for non-existent message', async () => {
      const { store } = createStore();
      const result = await store.appendEdit('nonexistent', 'msg', {
        body: 'test',
        normalizedUrls: [],
        urlHashes: [],
        timestamp: Date.now(),
      });
      expect(result).toBeNull();
    });

    it('limits edit history to 20 entries', async () => {
      const { store } = createStore();
      await store.recordMessageCreate({
        chatId: 'chat-7',
        messageId: 'msg-7',
        body: 'Original',
        normalizedUrls: [],
        urlHashes: [],
      });

      for (let i = 0; i < 25; i++) {
        await store.appendEdit('chat-7', 'msg-7', {
          body: `Edit ${i}`,
          normalizedUrls: [],
          urlHashes: [],
          timestamp: Date.now() + i,
        });
      }

      const record = await store.getRecord('chat-7', 'msg-7');
      expect(record?.edits).toHaveLength(20);
      expect(record?.edits[0].body).toBe('Edit 5');
      expect(record?.edits[19].body).toBe('Edit 24');
    });
  });

  describe('recordRevocation', () => {
    it('records message revocation', async () => {
      const { store } = createStore();
      await store.recordMessageCreate({
        chatId: 'chat-8',
        messageId: 'msg-8',
        body: 'To be revoked',
        normalizedUrls: [],
        urlHashes: [],
      });

      const result = await store.recordRevocation('chat-8', 'msg-8', 'everyone', Date.now());
      
      expect(result).not.toBeNull();
      expect(result?.revocations).toHaveLength(1);
      expect(result?.revocations[0].scope).toBe('everyone');
    });

    it('returns null for non-existent message', async () => {
      const { store } = createStore();
      const result = await store.recordRevocation('nonexistent', 'msg', 'me', Date.now());
      expect(result).toBeNull();
    });

    it('limits revocation history to 10 entries', async () => {
      const { store } = createStore();
      await store.recordMessageCreate({
        chatId: 'chat-9',
        messageId: 'msg-9',
        body: 'Test',
        normalizedUrls: [],
        urlHashes: [],
      });

      for (let i = 0; i < 15; i++) {
        await store.recordRevocation('chat-9', 'msg-9', 'everyone', Date.now() + i);
      }

      const record = await store.getRecord('chat-9', 'msg-9');
      expect(record?.revocations).toHaveLength(10);
    });
  });

  describe('recordReaction', () => {
    it('records message reaction', async () => {
      const { store } = createStore();
      await store.recordMessageCreate({
        chatId: 'chat-10',
        messageId: 'msg-10',
        body: 'React to me',
        normalizedUrls: [],
        urlHashes: [],
      });

      const result = await store.recordReaction('chat-10', 'msg-10', {
        reaction: '👍',
        senderId: 'user-10',
        timestamp: Date.now(),
      });
      
      expect(result).not.toBeNull();
      expect(result?.reactions).toHaveLength(1);
      expect(result?.reactions[0].reaction).toBe('👍');
    });

    it('returns null for non-existent message', async () => {
      const { store } = createStore();
      const result = await store.recordReaction('nonexistent', 'msg', {
        reaction: '👍',
        senderId: 'user',
        timestamp: Date.now(),
      });
      expect(result).toBeNull();
    });

    it('limits reaction history to 25 entries', async () => {
      const { store } = createStore();
      await store.recordMessageCreate({
        chatId: 'chat-11',
        messageId: 'msg-11',
        body: 'Test',
        normalizedUrls: [],
        urlHashes: [],
      });

      for (let i = 0; i < 30; i++) {
        await store.recordReaction('chat-11', 'msg-11', {
          reaction: '👍',
          senderId: `user-${i}`,
          timestamp: Date.now() + i,
        });
      }

      const record = await store.getRecord('chat-11', 'msg-11');
      expect(record?.reactions).toHaveLength(25);
    });
  });

  describe('registerVerdictAttempt', () => {
    it('registers verdict with all metadata', async () => {
      const { store } = createStore();
      const payload: VerdictAttemptPayload = {
        chatId: 'chat-12',
        messageId: 'msg-12',
        url: 'https://malware.com',
        urlHash: 'malwarehash',
        verdict: 'malicious',
        reasons: ['Known malware distribution', 'Phishing detected'],
        decidedAt: Date.now(),
        verdictMessageId: 'verdict-msg-1',
        ack: 2,
        attachments: { screenshot: true, ioc: false },
        redirectChain: ['https://short.ly', 'https://malware.com'],
        shortener: { provider: 'tiny', chain: ['https://tinyurl.com/x', 'https://malware.com'] },
        degradedProviders: [{ name: 'virustotal', reason: 'quota exceeded' }],
      };

      const result = await store.registerVerdictAttempt(payload);
      
      expect(result).not.toBeNull();
      expect(result?.verdict).toBe('malicious');
      expect(result?.reasons).toEqual(['Known malware distribution', 'Phishing detected']);
      expect(result?.status).toBe('sent');
      expect(result?.attemptCount).toBe(1);
      expect(result?.redirectChain).toEqual(['https://short.ly', 'https://malware.com']);
      expect(result?.shortener?.provider).toBe('tiny');
      expect(result?.degradedProviders?.[0].name).toBe('virustotal');
    });

    it('increments attempt count on subsequent attempts', async () => {
      const { store } = createStore();
      const basePayload: VerdictAttemptPayload = {
        chatId: 'chat-13',
        messageId: 'msg-13',
        url: 'https://example.com',
        urlHash: 'exhash',
        verdict: 'suspicious',
        reasons: ['Suspicious TLD'],
      };

      await store.registerVerdictAttempt(basePayload);
      await store.registerVerdictAttempt(basePayload);
      const result = await store.registerVerdictAttempt(basePayload);
      
      expect(result?.attemptCount).toBe(3);
    });

    it('maintains ack history across attempts', async () => {
      const { store } = createStore();
      const basePayload: VerdictAttemptPayload = {
        chatId: 'chat-14',
        messageId: 'msg-14',
        url: 'https://example.com',
        urlHash: 'ackhisthash',
        verdict: 'benign',
        reasons: [],
      };

      await store.registerVerdictAttempt({ ...basePayload, ack: 1 });
      await store.registerVerdictAttempt({ ...basePayload, ack: 2 });
      const result = await store.registerVerdictAttempt({ ...basePayload, ack: 3 });
      
      expect(result?.ackHistory).toHaveLength(3);
      expect(result?.ackHistory.map(h => h.ack)).toEqual([1, 2, 3]);
    });
  });

  describe('pending ack contexts', () => {
    it('adds, lists, and removes pending ack contexts', async () => {
      const { store } = createStore();
      const ctx1: VerdictContext = { chatId: 'c1', messageId: 'm1', urlHash: 'h1' };
      const ctx2: VerdictContext = { chatId: 'c2', messageId: 'm2', urlHash: 'h2' };

      await store.addPendingAckContext(ctx1);
      await store.addPendingAckContext(ctx2);

      let pending = await store.listPendingAckContexts(10);
      expect(pending).toHaveLength(2);
      expect(pending).toEqual(expect.arrayContaining([ctx1, ctx2]));

      await store.removePendingAckContext(ctx1);
      pending = await store.listPendingAckContexts(10);
      expect(pending).toHaveLength(1);
      expect(pending[0]).toEqual(ctx2);
    });

    it('returns empty array when limit is 0 or negative', async () => {
      const { store } = createStore();
      await store.addPendingAckContext({ chatId: 'c', messageId: 'm', urlHash: 'h' });
      
      expect(await store.listPendingAckContexts(0)).toEqual([]);
      expect(await store.listPendingAckContexts(-1)).toEqual([]);
    });

    it('respects limit parameter', async () => {
      const { store } = createStore();
      for (let i = 0; i < 10; i++) {
        await store.addPendingAckContext({
          chatId: `c${i}`,
          messageId: `m${i}`,
          urlHash: `h${i}`,
        });
      }

      const limited = await store.listPendingAckContexts(5);
      expect(limited).toHaveLength(5);
    });
  });

  describe('getVerdictRecord', () => {
    it('retrieves verdict by context', async () => {
      const { store } = createStore();
      await store.registerVerdictAttempt({
        chatId: 'chat-15',
        messageId: 'msg-15',
        url: 'https://test.com',
        urlHash: 'testhash',
        verdict: 'benign',
        reasons: [],
      });

      const verdict = await store.getVerdictRecord({
        chatId: 'chat-15',
        messageId: 'msg-15',
        urlHash: 'testhash',
      });
      
      expect(verdict).not.toBeNull();
      expect(verdict?.verdict).toBe('benign');
    });

    it('returns null for non-existent verdict', async () => {
      const { store } = createStore();
      const verdict = await store.getVerdictRecord({
        chatId: 'nonexistent',
        messageId: 'msg',
        urlHash: 'hash',
      });
      expect(verdict).toBeNull();
    });
  });
});
