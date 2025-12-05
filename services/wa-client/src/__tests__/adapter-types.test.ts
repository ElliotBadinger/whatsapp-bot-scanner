/**
 * Adapter Types Unit Tests
 * 
 * Tests for the WhatsAppAdapter interface types and content types.
 */

import { describe, it, expect } from '@jest/globals';
import type {
  WAMessage,
  MessageContent,
  TextContent,
  MediaContent,
  ReactionContent,
  StickerContent,
  LocationContent,
  ContactContent,
  SendMessageOptions,
  ConnectionState,
  DisconnectReason,
  GroupMetadata,
  Contact,
  Chat,
  PresenceType,
  WhatsAppAdapter,
} from '../adapters/types';

describe('Adapter Types', () => {
  describe('MessageContent Types', () => {
    it('should support text content', () => {
      const content: TextContent = {
        type: 'text',
        text: 'Hello World',
      };
      expect(content.type).toBe('text');
      expect(content.text).toBe('Hello World');
    });

    it('should support media content', () => {
      const content: MediaContent = {
        type: 'image',
        data: Buffer.from('test'),
        mimetype: 'image/jpeg',
        caption: 'Test image',
        filename: 'test.jpg',
      };
      expect(content.type).toBe('image');
      expect(content.mimetype).toBe('image/jpeg');
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

    it('should support sticker content', () => {
      const content: StickerContent = {
        type: 'sticker',
        data: Buffer.from('sticker-data'),
        mimetype: 'image/webp',
      };
      expect(content.type).toBe('sticker');
    });

    it('should support location content', () => {
      const content: LocationContent = {
        type: 'location',
        latitude: 37.7749,
        longitude: -122.4194,
        name: 'San Francisco',
        address: 'CA, USA',
      };
      expect(content.type).toBe('location');
      expect(content.latitude).toBe(37.7749);
      expect(content.longitude).toBe(-122.4194);
    });

    it('should support contact content', () => {
      const content: ContactContent = {
        type: 'contact',
        vcard: 'BEGIN:VCARD\nVERSION:3.0\nFN:John Doe\nEND:VCARD',
        displayName: 'John Doe',
      };
      expect(content.type).toBe('contact');
      expect(content.displayName).toBe('John Doe');
    });

    it('should allow MessageContent union type', () => {
      const contents: MessageContent[] = [
        { type: 'text', text: 'Hello' },
        { type: 'image', data: Buffer.from(''), mimetype: 'image/jpeg' },
        { type: 'reaction', emoji: '❤️', messageId: 'msg-1' },
        { type: 'sticker', data: Buffer.from('') },
        { type: 'location', latitude: 0, longitude: 0 },
        { type: 'contact', vcard: '', displayName: 'Test' },
      ];
      expect(contents).toHaveLength(6);
    });
  });

  describe('WAMessage Type', () => {
    it('should have required properties', () => {
      const message: WAMessage = {
        id: 'msg-123',
        chatId: '1234567890@s.whatsapp.net',
        senderId: '1234567890@s.whatsapp.net',
        body: 'Test message',
        isGroup: false,
        timestamp: Date.now(),
        fromMe: false,
        raw: {},
      };
      expect(message.id).toBe('msg-123');
      expect(message.isGroup).toBe(false);
    });

    it('should support optional quoted message', () => {
      const message: WAMessage = {
        id: 'msg-456',
        chatId: '1234567890@s.whatsapp.net',
        senderId: '1234567890@s.whatsapp.net',
        body: 'Reply message',
        isGroup: false,
        timestamp: Date.now(),
        fromMe: true,
        raw: {},
        quotedMessage: {
          id: 'msg-123',
          body: 'Original message',
          senderId: '0987654321@s.whatsapp.net',
        },
      };
      expect(message.quotedMessage?.id).toBe('msg-123');
    });
  });

  describe('GroupMetadata Type', () => {
    it('should have required properties', () => {
      const metadata: GroupMetadata = {
        id: 'group@g.us',
        name: 'Test Group',
        participants: [
          { id: 'user1@s.whatsapp.net', isAdmin: true, isSuperAdmin: false },
          { id: 'user2@s.whatsapp.net', isAdmin: false, isSuperAdmin: false },
        ],
      };
      expect(metadata.id).toBe('group@g.us');
      expect(metadata.participants).toHaveLength(2);
    });

    it('should support optional properties', () => {
      const metadata: GroupMetadata = {
        id: 'group@g.us',
        name: 'Test Group',
        description: 'A test group',
        owner: 'owner@s.whatsapp.net',
        participants: [],
        createdAt: Date.now(),
        inviteCode: 'ABC123',
      };
      expect(metadata.description).toBe('A test group');
      expect(metadata.inviteCode).toBe('ABC123');
    });
  });

  describe('Contact Type', () => {
    it('should have required id property', () => {
      const contact: Contact = {
        id: 'user@s.whatsapp.net',
      };
      expect(contact.id).toBe('user@s.whatsapp.net');
    });

    it('should support optional properties', () => {
      const contact: Contact = {
        id: 'user@s.whatsapp.net',
        name: 'John Doe',
        shortName: 'John',
        isBusiness: true,
        isBlocked: false,
      };
      expect(contact.name).toBe('John Doe');
      expect(contact.isBusiness).toBe(true);
    });
  });

  describe('Chat Type', () => {
    it('should have required properties', () => {
      const chat: Chat = {
        id: 'chat@s.whatsapp.net',
        name: 'Test Chat',
        isGroup: false,
      };
      expect(chat.id).toBe('chat@s.whatsapp.net');
      expect(chat.isGroup).toBe(false);
    });

    it('should support optional properties', () => {
      const chat: Chat = {
        id: 'group@g.us',
        name: 'Group Chat',
        isGroup: true,
        unreadCount: 5,
        lastMessageTimestamp: Date.now(),
        isArchived: false,
        isMuted: true,
      };
      expect(chat.unreadCount).toBe(5);
      expect(chat.isMuted).toBe(true);
    });
  });

  describe('PresenceType', () => {
    it('should support all presence types', () => {
      const presenceTypes: PresenceType[] = [
        'available',
        'unavailable',
        'composing',
        'recording',
        'paused',
      ];
      expect(presenceTypes).toHaveLength(5);
    });
  });

  describe('ConnectionState', () => {
    it('should support all connection states', () => {
      const states: ConnectionState[] = [
        'disconnected',
        'connecting',
        'connected',
        'ready',
      ];
      expect(states).toHaveLength(4);
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

  describe('SendMessageOptions', () => {
    it('should support optional properties', () => {
      const options: SendMessageOptions = {
        quotedMessageId: 'msg-123',
        mentions: ['user1@s.whatsapp.net', 'user2@s.whatsapp.net'],
      };
      expect(options.quotedMessageId).toBe('msg-123');
      expect(options.mentions).toHaveLength(2);
    });

    it('should allow empty options', () => {
      const options: SendMessageOptions = {};
      expect(options.quotedMessageId).toBeUndefined();
    });
  });
});

describe('WhatsAppAdapter Interface', () => {
  it('should define required methods', () => {
    // This is a compile-time check - if the interface is wrong, this won't compile
    const requiredMethods: (keyof WhatsAppAdapter)[] = [
      'state',
      'botId',
      'connect',
      'disconnect',
      'sendMessage',
      'reply',
      'react',
      'deleteMessage',
      'getGroupMetadata',
      'isOnWhatsApp',
      'requestPairingCode',
      'onMessage',
      'onConnectionChange',
      'onDisconnect',
      'onQRCode',
      'onPairingCode',
    ];
    expect(requiredMethods).toHaveLength(16);
  });

  it('should define optional extended methods', () => {
    // Optional methods are marked with ? in the interface
    const optionalMethods = [
      'getProfilePicUrl',
      'sendPresenceUpdate',
      'sendSeen',
      'forwardMessage',
      'downloadMedia',
      'createGroup',
      'addParticipants',
      'removeParticipants',
      'promoteParticipants',
      'demoteParticipants',
      'setGroupSubject',
      'setGroupDescription',
      'leaveGroup',
      'getInviteCode',
      'acceptInvite',
      'blockContact',
      'unblockContact',
      'getBlockedContacts',
    ];
    expect(optionalMethods).toHaveLength(18);
  });
});
