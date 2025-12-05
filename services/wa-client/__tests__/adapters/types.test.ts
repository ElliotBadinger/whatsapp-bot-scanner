/**
 * Adapter Types Tests
 * 
 * These tests verify the type definitions are correctly structured.
 */

import { describe, it, expect } from '@jest/globals';
import type {
  WhatsAppAdapter,
  ConnectionState,
  DisconnectReason,
  WAMessage,
  MessageContent,
  TextContent,
  MediaContent,
  ReactionContent,
  SendMessageOptions,
  SendResult,
  GroupMetadata,
  AdapterConfig,
  WhatsAppLibrary,
} from '../../src/adapters/types';

describe('Adapter Types', () => {
  describe('ConnectionState', () => {
    it('should accept valid connection states', () => {
      const states: ConnectionState[] = [
        'disconnected',
        'connecting',
        'connected',
        'ready',
      ];
      expect(states).toHaveLength(4);
    });
  });

  describe('WhatsAppLibrary', () => {
    it('should accept valid library types', () => {
      const libraries: WhatsAppLibrary[] = ['baileys', 'wwebjs'];
      expect(libraries).toHaveLength(2);
    });
  });

  describe('WAMessage', () => {
    it('should have required properties', () => {
      const message: WAMessage = {
        id: 'msg-123',
        chatId: 'chat-456',
        senderId: 'sender-789',
        body: 'Hello world',
        isGroup: false,
        timestamp: Date.now(),
        fromMe: false,
        raw: {},
      };

      expect(message.id).toBe('msg-123');
      expect(message.chatId).toBe('chat-456');
      expect(message.senderId).toBe('sender-789');
      expect(message.body).toBe('Hello world');
      expect(message.isGroup).toBe(false);
      expect(message.fromMe).toBe(false);
    });

    it('should support optional quotedMessage', () => {
      const message: WAMessage = {
        id: 'msg-123',
        chatId: 'chat-456',
        senderId: 'sender-789',
        body: 'Reply text',
        isGroup: false,
        timestamp: Date.now(),
        fromMe: false,
        raw: {},
        quotedMessage: {
          id: 'quoted-msg-111',
          body: 'Original message',
          senderId: 'original-sender',
        },
      };

      expect(message.quotedMessage).toBeDefined();
      expect(message.quotedMessage?.id).toBe('quoted-msg-111');
    });
  });

  describe('MessageContent', () => {
    it('should support text content', () => {
      const content: TextContent = {
        type: 'text',
        text: 'Hello world',
      };
      expect(content.type).toBe('text');
      expect(content.text).toBe('Hello world');
    });

    it('should support media content', () => {
      const content: MediaContent = {
        type: 'image',
        data: Buffer.from('fake-image-data'),
        mimetype: 'image/png',
        caption: 'Test image',
      };
      expect(content.type).toBe('image');
      expect(content.mimetype).toBe('image/png');
    });

    it('should support reaction content', () => {
      const content: ReactionContent = {
        type: 'reaction',
        emoji: '👍',
        messageId: 'msg-123',
      };
      expect(content.type).toBe('reaction');
      expect(content.emoji).toBe('👍');
    });
  });

  describe('DisconnectReason', () => {
    it('should have required properties', () => {
      const reason: DisconnectReason = {
        code: 401,
        message: 'Logged out',
        isLoggedOut: true,
        shouldReconnect: false,
      };

      expect(reason.code).toBe(401);
      expect(reason.isLoggedOut).toBe(true);
      expect(reason.shouldReconnect).toBe(false);
    });
  });

  describe('SendResult', () => {
    it('should have required properties', () => {
      const result: SendResult = {
        messageId: 'sent-msg-123',
        timestamp: Date.now(),
        success: true,
      };

      expect(result.messageId).toBe('sent-msg-123');
      expect(result.success).toBe(true);
    });
  });

  describe('GroupMetadata', () => {
    it('should have required properties', () => {
      const group: GroupMetadata = {
        id: 'group-123',
        name: 'Test Group',
        participants: [
          { id: 'user-1', isAdmin: true, isSuperAdmin: true },
          { id: 'user-2', isAdmin: false, isSuperAdmin: false },
        ],
      };

      expect(group.id).toBe('group-123');
      expect(group.name).toBe('Test Group');
      expect(group.participants).toHaveLength(2);
    });

    it('should support optional properties', () => {
      const group: GroupMetadata = {
        id: 'group-123',
        name: 'Test Group',
        description: 'A test group',
        owner: 'owner-user',
        participants: [],
        createdAt: Date.now(),
      };

      expect(group.description).toBe('A test group');
      expect(group.owner).toBe('owner-user');
      expect(group.createdAt).toBeDefined();
    });
  });
});
