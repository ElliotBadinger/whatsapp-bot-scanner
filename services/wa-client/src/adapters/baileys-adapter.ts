/**
 * Baileys WhatsApp Adapter
 * 
 * This module implements the WhatsAppAdapter interface using the Baileys library.
 * Baileys provides a protocol-based connection to WhatsApp, which is more
 * lightweight and reliable than browser-based approaches.
 */

import makeWASocket, {
  DisconnectReason as BaileysDisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  isJidGroup,
  jidNormalizedUser,
  type WASocket,
  type BaileysEventMap,
  type ConnectionState as BaileysConnectionState,
  type proto as BaileysProto,
  type WAMessage as BaileysWAMessage,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import type { Logger } from 'pino';

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
import { useRedisAuthState, sessionExists } from '../auth/baileys-auth-store';

/**
 * Baileys implementation of the WhatsAppAdapter interface
 */
export class BaileysAdapter implements WhatsAppAdapter {
  private socket: WASocket | null = null;
  private config: AdapterConfig;
  private logger: Logger;
  private _state: ConnectionState = 'disconnected';
  private _botId: string | null = null;

  // Event handlers
  private messageHandlers: MessageHandler[] = [];
  private connectionHandlers: ConnectionHandler[] = [];
  private disconnectHandlers: DisconnectHandler[] = [];
  private qrCodeHandlers: QRCodeHandler[] = [];
  private pairingCodeHandlers: PairingCodeHandler[] = [];

  // Auth state management
  private saveCreds: (() => Promise<void>) | null = null;
  private clearState: (() => Promise<void>) | null = null;

  constructor(config: AdapterConfig) {
    this.config = config;
    this.logger = config.logger.child({ adapter: 'baileys' });
  }

  get state(): ConnectionState {
    return this._state;
  }

  get botId(): string | null {
    return this._botId;
  }

  /**
   * Initialize and connect the Baileys socket
   */
  async connect(): Promise<void> {
    if (this.socket) {
      this.logger.warn('Socket already exists, disconnecting first');
      await this.disconnect();
    }

    this.setState('connecting');

    try {
      // Initialize Redis auth state
      const { state: authState, saveCreds, clearState } = await useRedisAuthState({
        redis: this.config.redis,
        logger: this.logger,
        prefix: 'baileys:auth',
        clientId: this.config.clientId,
      });

      this.saveCreds = saveCreds;
      this.clearState = clearState;

      // Fetch latest Baileys version
      const { version, isLatest } = await fetchLatestBaileysVersion();
      this.logger.info({ version, isLatest }, 'Using Baileys version');

      // Create the socket
      this.socket = makeWASocket({
        version,
        auth: {
          creds: authState.creds,
          keys: makeCacheableSignalKeyStore(authState.keys, this.logger),
        },
        printQRInTerminal: this.config.printQRInTerminal ?? false,
        logger: this.logger,
        browser: [this.config.browserName ?? 'WBScanner', 'Chrome', '120.0.0'],
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
        markOnlineOnConnect: false,
      });

      // Set up event handlers
      this.setupEventHandlers();

      this.logger.info('Baileys socket created, waiting for connection');
    } catch (err) {
      this.logger.error({ err }, 'Failed to create Baileys socket');
      this.setState('disconnected');
      throw err;
    }
  }

  /**
   * Set up Baileys event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Connection state updates
    this.socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // Handle QR code
      if (qr) {
        this.logger.info('QR code received');
        for (const handler of this.qrCodeHandlers) {
          handler(qr);
        }
      }

      // Handle connection state changes
      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const isLoggedOut = statusCode === BaileysDisconnectReason.loggedOut;
        const shouldReconnect = !isLoggedOut;

        const reason: DisconnectReason = {
          code: statusCode ?? 0,
          message: (lastDisconnect?.error as Error)?.message ?? 'Unknown error',
          isLoggedOut,
          shouldReconnect,
        };

        this.logger.info({ reason }, 'Connection closed');
        this.setState('disconnected');

        // Clear auth state if logged out
        if (isLoggedOut && this.clearState) {
          await this.clearState();
        }

        // Notify disconnect handlers
        for (const handler of this.disconnectHandlers) {
          handler(reason);
        }

        // Auto-reconnect if appropriate
        if (shouldReconnect) {
          this.logger.info('Attempting to reconnect...');
          setTimeout(() => this.connect(), 5000);
        }
      } else if (connection === 'open') {
        this._botId = this.socket?.user?.id ?? null;
        this.logger.info({ botId: this._botId }, 'Connection opened');
        this.setState('ready');
      } else if (connection === 'connecting') {
        this.setState('connecting');
      }
    });

    // Credentials update
    this.socket.ev.on('creds.update', async () => {
      if (this.saveCreds) {
        await this.saveCreds();
      }
    });

    // Message events
    this.socket.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        // Skip status broadcasts
        if (msg.key.remoteJid === 'status@broadcast') continue;

        const waMessage = this.convertMessage(msg);
        if (!waMessage) continue;

        for (const handler of this.messageHandlers) {
          try {
            await handler(waMessage);
          } catch (err) {
            this.logger.error({ err, messageId: waMessage.id }, 'Message handler error');
          }
        }
      }
    });
  }

  /**
   * Convert a Baileys message to our WAMessage format
   */
  private convertMessage(msg: BaileysProto.IWebMessageInfo): WAMessage | null {
    const key = msg.key;
    if (!key || !key.remoteJid || !key.id) return null;

    const messageContent = msg.message;
    if (!messageContent) return null;

    // Extract text from various message types
    let body = '';
    if (messageContent.conversation) {
      body = messageContent.conversation;
    } else if (messageContent.extendedTextMessage?.text) {
      body = messageContent.extendedTextMessage.text;
    } else if (messageContent.imageMessage?.caption) {
      body = messageContent.imageMessage.caption;
    } else if (messageContent.videoMessage?.caption) {
      body = messageContent.videoMessage.caption;
    } else if (messageContent.documentMessage?.caption) {
      body = messageContent.documentMessage.caption;
    }

    const remoteJid = key.remoteJid;
    const isGroup = isJidGroup(remoteJid) ?? false;
    const senderId = isGroup
      ? key.participant ?? remoteJid
      : remoteJid;

    // Extract quoted message if present
    let quotedMessage: WAMessage['quotedMessage'];
    const contextInfo = messageContent.extendedTextMessage?.contextInfo;
    if (contextInfo?.quotedMessage && contextInfo.stanzaId) {
      const quotedContent = contextInfo.quotedMessage;
      let quotedBody = '';
      if (quotedContent.conversation) {
        quotedBody = quotedContent.conversation;
      } else if (quotedContent.extendedTextMessage?.text) {
        quotedBody = quotedContent.extendedTextMessage.text;
      }

      quotedMessage = {
        id: contextInfo.stanzaId,
        body: quotedBody,
        senderId: contextInfo.participant ?? remoteJid,
      };
    }

    return {
      id: key.id,
      chatId: remoteJid,
      senderId: jidNormalizedUser(senderId),
      body,
      isGroup,
      timestamp: (msg.messageTimestamp as number) * 1000,
      fromMe: key.fromMe ?? false,
      raw: msg,
      quotedMessage,
    };
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
   * Disconnect the Baileys socket
   */
  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.end(undefined);
      this.socket = null;
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
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    let messageContent: Parameters<WASocket['sendMessage']>[1];

    switch (content.type) {
      case 'text':
        messageContent = { text: content.text };
        break;
      case 'image':
        messageContent = {
          image: typeof content.data === 'string' ? Buffer.from(content.data, 'base64') : content.data,
          caption: content.caption,
          mimetype: content.mimetype,
        };
        break;
      case 'video':
        messageContent = {
          video: typeof content.data === 'string' ? Buffer.from(content.data, 'base64') : content.data,
          caption: content.caption,
          mimetype: content.mimetype,
        };
        break;
      case 'audio':
        messageContent = {
          audio: typeof content.data === 'string' ? Buffer.from(content.data, 'base64') : content.data,
          mimetype: content.mimetype,
        };
        break;
      case 'document':
        messageContent = {
          document: typeof content.data === 'string' ? Buffer.from(content.data, 'base64') : content.data,
          mimetype: content.mimetype,
          fileName: content.filename,
        };
        break;
      case 'reaction':
        await this.socket.sendMessage(jid, {
          react: {
            text: content.emoji,
            key: { remoteJid: jid, id: content.messageId },
          },
        });
        return {
          messageId: `reaction-${Date.now()}`,
          timestamp: Date.now(),
          success: true,
        };
      default:
        throw new Error(`Unsupported content type: ${(content as MessageContent).type}`);
    }

    const sendOptions: Parameters<WASocket['sendMessage']>[2] = {};
    if (options?.quotedMessageId) {
      // Create a minimal quoted message structure for Baileys v7
      sendOptions.quoted = {
        key: { 
          remoteJid: jid, 
          id: options.quotedMessageId,
          fromMe: false,
        },
        message: {},
      } as BaileysWAMessage;
    }

    const result = await this.socket.sendMessage(jid, messageContent, sendOptions);

    return {
      messageId: result?.key?.id ?? '',
      timestamp: Date.now(),
      success: !!result?.key?.id,
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
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    await this.socket.sendMessage(message.chatId, {
      react: {
        text: emoji,
        key: { remoteJid: message.chatId, id: message.id },
      },
    });
  }

  /**
   * Delete a message
   */
  async deleteMessage(message: WAMessage, forEveryone = true): Promise<void> {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    await this.socket.sendMessage(message.chatId, {
      delete: {
        remoteJid: message.chatId,
        id: message.id,
        fromMe: message.fromMe,
      },
    });
  }

  /**
   * Get group metadata
   */
  async getGroupMetadata(groupId: string): Promise<GroupMetadata | null> {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    try {
      const metadata = await this.socket.groupMetadata(groupId);
      return {
        id: metadata.id,
        name: metadata.subject,
        description: metadata.desc ?? undefined,
        owner: metadata.owner ?? undefined,
        participants: metadata.participants.map((p) => ({
          id: p.id,
          isAdmin: p.admin === 'admin' || p.admin === 'superadmin',
          isSuperAdmin: p.admin === 'superadmin',
        })),
        createdAt: metadata.creation ? metadata.creation * 1000 : undefined,
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
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    try {
      const results = await this.socket.onWhatsApp(phoneNumber);
      if (!results || results.length === 0) return false;
      return !!results[0]?.exists;
    } catch (err) {
      this.logger.warn({ err, phoneNumber }, 'Failed to check if number is on WhatsApp');
      return false;
    }
  }

  /**
   * Request a pairing code for phone number authentication
   */
  async requestPairingCode(phoneNumber: string): Promise<string> {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    // Remove any non-numeric characters
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    
    const code = await this.socket.requestPairingCode(cleanNumber);
    
    // Notify pairing code handlers
    for (const handler of this.pairingCodeHandlers) {
      handler(code);
    }

    return code;
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
 * Check if a Baileys session exists
 */
export async function baileysSessionExists(
  redis: import('ioredis').default,
  clientId: string
): Promise<boolean> {
  return sessionExists(redis, 'baileys:auth', clientId);
}
