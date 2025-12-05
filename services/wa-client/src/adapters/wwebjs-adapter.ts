/**
 * whatsapp-web.js WhatsApp Adapter
 * 
 * This module implements the WhatsAppAdapter interface using the whatsapp-web.js library.
 * whatsapp-web.js uses Puppeteer to automate a Chrome browser running WhatsApp Web.
 * 
 * Note: This adapter is provided for legacy support. For new deployments,
 * the Baileys adapter is recommended due to lower resource usage and better reliability.
 */

import {
  Client,
  LocalAuth,
  RemoteAuth,
  Message,
  MessageMedia,
  type Chat,
  type GroupChat,
} from 'whatsapp-web.js';
import type { Logger } from 'pino';
import type Redis from 'ioredis';

import {
  type WhatsAppAdapter,
  type AdapterConfig,
  type ConnectionState,
  type DisconnectReason,
  type WAMessage,
  type MessageContent,
  type SendMessageOptions,
  type SendResult,
  type GroupMetadata,
  type MessageHandler,
  type ConnectionHandler,
  type DisconnectHandler,
  type QRCodeHandler,
  type PairingCodeHandler,
} from './types';
import { createRemoteAuthStore, type RedisRemoteAuthStore } from '../remoteAuthStore';
import { loadEncryptionMaterials } from '../crypto/dataKeyProvider';
import { config } from '@wbscanner/shared';

/**
 * Extended adapter config for WWebJS-specific options
 */
export interface WWebJSAdapterConfig extends AdapterConfig {
  /** Use RemoteAuth (Redis-backed) instead of LocalAuth */
  useRemoteAuth?: boolean;
  /** Path for session data storage */
  dataPath?: string;
  /** Puppeteer launch arguments */
  puppeteerArgs?: string[];
}

/**
 * whatsapp-web.js implementation of the WhatsAppAdapter interface
 */
export class WWebJSAdapter implements WhatsAppAdapter {
  private client: Client | null = null;
  private config: WWebJSAdapterConfig;
  private logger: Logger;
  private _state: ConnectionState = 'disconnected';
  private _botId: string | null = null;

  // Event handlers
  private messageHandlers: MessageHandler[] = [];
  private connectionHandlers: ConnectionHandler[] = [];
  private disconnectHandlers: DisconnectHandler[] = [];
  private qrCodeHandlers: QRCodeHandler[] = [];
  private pairingCodeHandlers: PairingCodeHandler[] = [];

  // Auth store for RemoteAuth
  private authStore: RedisRemoteAuthStore | null = null;

  constructor(config: WWebJSAdapterConfig) {
    this.config = config;
    this.logger = config.logger.child({ adapter: 'wwebjs' });
  }

  get state(): ConnectionState {
    return this._state;
  }

  get botId(): string | null {
    return this._botId;
  }

  /**
   * Initialize and connect the whatsapp-web.js client
   */
  async connect(): Promise<void> {
    if (this.client) {
      this.logger.warn('Client already exists, disconnecting first');
      await this.disconnect();
    }

    this.setState('connecting');

    try {
      // Resolve auth strategy
      const authStrategy = await this.resolveAuthStrategy();

      // Create the client with Puppeteer configuration
      this.client = new Client({
        authStrategy,
        puppeteer: {
          headless: true,
          args: this.config.puppeteerArgs ?? [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--single-process',
          ],
        },
      });

      // Set up event handlers
      this.setupEventHandlers();

      // Initialize the client
      this.logger.info('Initializing whatsapp-web.js client...');
      await this.client.initialize();
      this.logger.info('whatsapp-web.js client initialized');
    } catch (err) {
      this.logger.error({ err }, 'Failed to create whatsapp-web.js client');
      this.setState('disconnected');
      throw err;
    }
  }

  /**
   * Resolve the authentication strategy (LocalAuth or RemoteAuth)
   */
  private async resolveAuthStrategy(): Promise<LocalAuth | RemoteAuth> {
    if (this.config.useRemoteAuth) {
      // Load encryption materials for RemoteAuth
      const materials = await loadEncryptionMaterials(config.wa.remoteAuth, this.logger);
      
      this.authStore = createRemoteAuthStore({
        redis: this.config.redis,
        logger: this.logger,
        prefix: `remoteauth:v1:${this.config.clientId}`,
        materials,
        clientId: this.config.clientId,
      });

      this.logger.info({ clientId: this.config.clientId }, 'Using RemoteAuth strategy');
      
      return new RemoteAuth({
        clientId: this.config.clientId,
        dataPath: this.config.dataPath ?? './data/remote-session',
        store: this.authStore,
        backupSyncIntervalMs: config.wa.remoteAuth.backupIntervalMs,
      });
    }

    this.logger.info('Using LocalAuth strategy');
    return new LocalAuth({
      dataPath: this.config.dataPath ?? './data/session',
    });
  }

  /**
   * Set up whatsapp-web.js event handlers
   */
  private setupEventHandlers(): void {
    if (!this.client) return;

    // QR code event
    this.client.on('qr', (qr: string) => {
      this.logger.info('QR code received');
      for (const handler of this.qrCodeHandlers) {
        handler(qr);
      }
    });

    // Authentication event
    this.client.on('authenticated', () => {
      this.logger.info('Client authenticated');
      this.setState('connected');
    });

    // Ready event
    this.client.on('ready', () => {
      this._botId = this.client?.info?.wid?._serialized ?? null;
      this.logger.info({ botId: this._botId }, 'Client ready');
      this.setState('ready');
    });

    // Auth failure event
    this.client.on('auth_failure', (msg: string) => {
      this.logger.error({ msg }, 'Authentication failed');
      const reason: DisconnectReason = {
        code: 401,
        message: msg,
        isLoggedOut: true,
        shouldReconnect: false,
      };
      for (const handler of this.disconnectHandlers) {
        handler(reason);
      }
      this.setState('disconnected');
    });

    // Disconnected event
    this.client.on('disconnected', (reason: string) => {
      this.logger.info({ reason }, 'Client disconnected');
      const disconnectReason: DisconnectReason = {
        code: 0,
        message: reason,
        isLoggedOut: reason === 'LOGOUT',
        shouldReconnect: reason !== 'LOGOUT',
      };
      for (const handler of this.disconnectHandlers) {
        handler(disconnectReason);
      }
      this._botId = null;
      this.setState('disconnected');
    });

    // State change event
    this.client.on('change_state', (state: string) => {
      this.logger.debug({ state }, 'Client state changed');
    });

    // Message event
    this.client.on('message', async (msg: Message) => {
      const waMessage = await this.convertMessage(msg);
      if (!waMessage) return;

      for (const handler of this.messageHandlers) {
        try {
          await handler(waMessage);
        } catch (err) {
          this.logger.error({ err, messageId: waMessage.id }, 'Message handler error');
        }
      }
    });

    // Message create event (includes own messages)
    this.client.on('message_create', async (msg: Message) => {
      // Only process messages from self
      if (!msg.fromMe) return;

      const waMessage = await this.convertMessage(msg);
      if (!waMessage) return;

      for (const handler of this.messageHandlers) {
        try {
          await handler(waMessage);
        } catch (err) {
          this.logger.error({ err, messageId: waMessage.id }, 'Message handler error');
        }
      }
    });
  }

  /**
   * Convert a whatsapp-web.js message to our WAMessage format
   */
  private async convertMessage(msg: Message): Promise<WAMessage | null> {
    try {
      const chat = await msg.getChat();
      const isGroup = chat.isGroup;

      // Get quoted message if present
      let quotedMessage: WAMessage['quotedMessage'];
      if (msg.hasQuotedMsg) {
        try {
          const quoted = await msg.getQuotedMessage();
          quotedMessage = {
            id: quoted.id._serialized,
            body: quoted.body,
            senderId: quoted.from,
          };
        } catch (err) {
          this.logger.debug({ err }, 'Failed to get quoted message');
        }
      }

      return {
        id: msg.id._serialized,
        chatId: msg.from,
        senderId: isGroup ? (msg.author ?? msg.from) : msg.from,
        body: msg.body,
        isGroup,
        timestamp: msg.timestamp * 1000,
        fromMe: msg.fromMe,
        raw: msg,
        quotedMessage,
      };
    } catch (err) {
      this.logger.warn({ err, messageId: msg.id?._serialized }, 'Failed to convert message');
      return null;
    }
  }

  /**
   * Update and broadcast connection state
   */
  private setState(state: ConnectionState): void {
    if (this._state !== state) {
      this._state = state;
      for (const handler of this.connectionHandlers) {
        handler(state);
      }
    }
  }

  /**
   * Disconnect the whatsapp-web.js client
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.destroy();
      } catch (err) {
        this.logger.warn({ err }, 'Error destroying client');
      }
      this.client = null;
    }
    this._botId = null;
    this.setState('disconnected');
    this.logger.info('Disconnected from WhatsApp');
  }

  /**
   * Send a message
   */
  async sendMessage(
    jid: string,
    content: MessageContent,
    options?: SendMessageOptions
  ): Promise<SendResult> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    let result: Message;

    switch (content.type) {
      case 'text':
        result = await this.client.sendMessage(jid, content.text, {
          quotedMessageId: options?.quotedMessageId,
        });
        break;

      case 'image':
      case 'video':
      case 'audio':
      case 'document': {
        const media = new MessageMedia(
          content.mimetype,
          typeof content.data === 'string' ? content.data : content.data.toString('base64'),
          content.filename
        );
        result = await this.client.sendMessage(jid, media, {
          caption: content.caption,
          quotedMessageId: options?.quotedMessageId,
          sendMediaAsDocument: content.type === 'document',
        });
        break;
      }

      case 'reaction': {
        const msg = await this.client.getMessageById(content.messageId);
        if (msg) {
          await msg.react(content.emoji);
        }
        return {
          messageId: `reaction-${Date.now()}`,
          timestamp: Date.now(),
          success: true,
        };
      }

      default:
        throw new Error(`Unsupported content type: ${(content as MessageContent).type}`);
    }

    return {
      messageId: result.id._serialized,
      timestamp: Date.now(),
      success: true,
    };
  }

  /**
   * Reply to a message
   */
  async reply(message: WAMessage, content: MessageContent): Promise<SendResult> {
    return this.sendMessage(message.chatId, content, {
      quotedMessageId: message.id,
    });
  }

  /**
   * React to a message
   */
  async react(message: WAMessage, emoji: string): Promise<void> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    const msg = message.raw as Message;
    await msg.react(emoji);
  }

  /**
   * Delete a message
   */
  async deleteMessage(message: WAMessage, forEveryone = true): Promise<void> {
    const msg = message.raw as Message;
    await msg.delete(forEveryone);
  }

  /**
   * Get group metadata
   */
  async getGroupMetadata(groupId: string): Promise<GroupMetadata | null> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    try {
      const chat = await this.client.getChatById(groupId) as GroupChat;
      if (!chat.isGroup) {
        return null;
      }

      const participants = chat.participants ?? [];

      return {
        id: chat.id._serialized,
        name: chat.name,
        description: chat.description ?? undefined,
        owner: chat.owner?._serialized,
        participants: participants.map((p) => ({
          id: p.id._serialized,
          isAdmin: p.isAdmin,
          isSuperAdmin: p.isSuperAdmin,
        })),
        createdAt: chat.createdAt ? chat.createdAt.getTime() : undefined,
      };
    } catch (err) {
      this.logger.warn({ err, groupId }, 'Failed to get group metadata');
      return null;
    }
  }

  /**
   * Check if a number is on WhatsApp
   */
  async isOnWhatsApp(phoneNumber: string): Promise<boolean> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    try {
      const result = await this.client.isRegisteredUser(phoneNumber);
      return result;
    } catch (err) {
      this.logger.warn({ err, phoneNumber }, 'Failed to check if number is on WhatsApp');
      return false;
    }
  }

  /**
   * Request a pairing code for phone number authentication
   * 
   * Note: This requires accessing internal Puppeteer page, which may be unstable.
   */
  async requestPairingCode(phoneNumber: string): Promise<string> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    // Remove any non-numeric characters
    const cleanNumber = phoneNumber.replace(/\D/g, '');

    try {
      // Access the internal Puppeteer page
      const page = (this.client as unknown as { pupPage?: { evaluate: (fn: string) => Promise<string> } }).pupPage;
      if (!page) {
        throw new Error('Puppeteer page not available');
      }

      // Request pairing code via WhatsApp Web internal API
      const code = await page.evaluate(`
        (async () => {
          const { PairingCodeLinkUtils } = window.Store?.AuthStore || {};
          if (!PairingCodeLinkUtils) {
            throw new Error('PairingCodeLinkUtils not available');
          }
          await PairingCodeLinkUtils.initializeAltDeviceLinking();
          const code = await PairingCodeLinkUtils.startAltLinkingFlow('${cleanNumber}', false);
          return code;
        })()
      `);

      // Notify pairing code handlers
      for (const handler of this.pairingCodeHandlers) {
        handler(code);
      }

      return code;
    } catch (err) {
      this.logger.error({ err }, 'Failed to request pairing code');
      throw err;
    }
  }

  // Event handler registration
  onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  onConnectionChange(handler: ConnectionHandler): void {
    this.connectionHandlers.push(handler);
  }

  onDisconnect(handler: DisconnectHandler): void {
    this.disconnectHandlers.push(handler);
  }

  onQRCode(handler: QRCodeHandler): void {
    this.qrCodeHandlers.push(handler);
  }

  onPairingCode(handler: PairingCodeHandler): void {
    this.pairingCodeHandlers.push(handler);
  }
}

/**
 * Check if a WWebJS session exists
 */
export async function wwebjsSessionExists(
  redis: Redis,
  clientId: string
): Promise<boolean> {
  const key = `remoteauth:v1:${clientId}:RemoteAuth-${clientId}`;
  const exists = await redis.exists(key);
  return exists === 1;
}
