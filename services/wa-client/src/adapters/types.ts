/**
 * WhatsApp Adapter Interface
 * 
 * This module defines the common interface for WhatsApp client adapters.
 * Both Baileys and whatsapp-web.js implementations must conform to this interface.
 */

import type { Logger } from 'pino';
import type Redis from 'ioredis';

/**
 * Connection state for the WhatsApp adapter
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'ready';

/**
 * Reason for disconnection
 */
export interface DisconnectReason {
  code: number;
  message: string;
  isLoggedOut: boolean;
  shouldReconnect: boolean;
}

/**
 * Represents a WhatsApp message
 */
export interface WAMessage {
  /** Unique message ID */
  id: string;
  /** Chat/conversation ID (JID) */
  chatId: string;
  /** Sender ID (JID) */
  senderId: string;
  /** Message body text */
  body: string;
  /** Whether this is a group message */
  isGroup: boolean;
  /** Timestamp of the message */
  timestamp: number;
  /** Whether the message is from the bot itself */
  fromMe: boolean;
  /** Original raw message object from the library */
  raw: unknown;
  /** Quoted message if this is a reply */
  quotedMessage?: {
    id: string;
    body: string;
    senderId: string;
  };
}

/**
 * Content types for sending messages
 */
export interface TextContent {
  type: 'text';
  text: string;
}

export interface MediaContent {
  type: 'image' | 'video' | 'audio' | 'document';
  data: Buffer | string;
  mimetype: string;
  filename?: string;
  caption?: string;
}

export interface ReactionContent {
  type: 'reaction';
  emoji: string;
  messageId: string;
}

export type MessageContent = TextContent | MediaContent | ReactionContent;

/**
 * Options for sending messages
 */
export interface SendMessageOptions {
  /** Quote/reply to a specific message */
  quotedMessageId?: string;
  /** Mentions in the message */
  mentions?: string[];
}

/**
 * Handler for incoming messages
 */
export type MessageHandler = (message: WAMessage) => Promise<void>;

/**
 * Handler for connection state changes
 */
export type ConnectionHandler = (state: ConnectionState) => void;

/**
 * Handler for disconnection events
 */
export type DisconnectHandler = (reason: DisconnectReason) => void;

/**
 * Handler for QR code events (for pairing)
 */
export type QRCodeHandler = (qr: string) => void;

/**
 * Handler for pairing code events (phone number pairing)
 */
export type PairingCodeHandler = (code: string) => void;

/**
 * Configuration for the WhatsApp adapter
 */
export interface AdapterConfig {
  /** Redis client for session storage */
  redis: Redis;
  /** Logger instance */
  logger: Logger;
  /** Session/client ID for multi-device support */
  clientId: string;
  /** Phone number for pairing (optional, for phone number pairing mode) */
  phoneNumber?: string;
  /** Whether to print QR code to terminal */
  printQRInTerminal?: boolean;
  /** Data path for session storage */
  dataPath?: string;
  /** Browser name to show in WhatsApp */
  browserName?: string;
}

/**
 * Result of sending a message
 */
export interface SendResult {
  /** Message ID of the sent message */
  messageId: string;
  /** Timestamp when the message was sent */
  timestamp: number;
  /** Whether the message was sent successfully */
  success: boolean;
}

/**
 * Group metadata
 */
export interface GroupMetadata {
  /** Group JID */
  id: string;
  /** Group name/subject */
  name: string;
  /** Group description */
  description?: string;
  /** Group owner JID */
  owner?: string;
  /** List of participant JIDs */
  participants: Array<{
    id: string;
    isAdmin: boolean;
    isSuperAdmin: boolean;
  }>;
  /** Creation timestamp */
  createdAt?: number;
}

/**
 * WhatsApp Adapter Interface
 * 
 * All WhatsApp client implementations must implement this interface.
 */
export interface WhatsAppAdapter {
  /** Current connection state */
  readonly state: ConnectionState;
  
  /** Bot's own JID (available after ready) */
  readonly botId: string | null;

  /**
   * Initialize and connect the WhatsApp client
   */
  connect(): Promise<void>;

  /**
   * Disconnect the WhatsApp client
   */
  disconnect(): Promise<void>;

  /**
   * Send a message to a chat
   * @param jid - The chat JID to send to
   * @param content - The message content
   * @param options - Optional send options
   */
  sendMessage(jid: string, content: MessageContent, options?: SendMessageOptions): Promise<SendResult>;

  /**
   * Reply to a message
   * @param message - The message to reply to
   * @param content - The reply content
   */
  reply(message: WAMessage, content: MessageContent): Promise<SendResult>;

  /**
   * React to a message with an emoji
   * @param message - The message to react to
   * @param emoji - The emoji to react with
   */
  react(message: WAMessage, emoji: string): Promise<void>;

  /**
   * Delete a message
   * @param message - The message to delete
   * @param forEveryone - Whether to delete for everyone or just for the bot
   */
  deleteMessage(message: WAMessage, forEveryone?: boolean): Promise<void>;

  /**
   * Get group metadata
   * @param groupId - The group JID
   */
  getGroupMetadata(groupId: string): Promise<GroupMetadata | null>;

  /**
   * Check if a number is registered on WhatsApp
   * @param phoneNumber - The phone number to check (with country code)
   */
  isOnWhatsApp(phoneNumber: string): Promise<boolean>;

  /**
   * Request a pairing code for phone number authentication
   * @param phoneNumber - The phone number to pair with
   */
  requestPairingCode(phoneNumber: string): Promise<string>;

  /**
   * Register a handler for incoming messages
   */
  onMessage(handler: MessageHandler): void;

  /**
   * Register a handler for connection state changes
   */
  onConnectionChange(handler: ConnectionHandler): void;

  /**
   * Register a handler for disconnection events
   */
  onDisconnect(handler: DisconnectHandler): void;

  /**
   * Register a handler for QR code events
   */
  onQRCode(handler: QRCodeHandler): void;

  /**
   * Register a handler for pairing code events
   */
  onPairingCode(handler: PairingCodeHandler): void;
}

/**
 * Library type for the adapter factory
 */
export type WhatsAppLibrary = 'baileys' | 'wwebjs';
