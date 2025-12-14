/**
 * WhatsApp Adapter Interface
 *
 * This module defines the common interface for WhatsApp client adapters.
 * Both Baileys and whatsapp-web.js implementations must conform to this interface.
 */

import type { Logger } from "pino";
import type { Redis } from "ioredis";

/**
 * Connection state for the WhatsApp adapter
 */
export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "ready";

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
  type: "text";
  text: string;
}

export interface MediaContent {
  type: "image" | "video" | "audio" | "document";
  data: Buffer | string;
  mimetype: string;
  filename?: string;
  caption?: string;
}

export interface ReactionContent {
  type: "reaction";
  emoji: string;
  messageId: string;
}

export interface StickerContent {
  type: "sticker";
  data: Buffer | string;
  mimetype?: string;
}

export interface LocationContent {
  type: "location";
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface ContactContent {
  type: "contact";
  vcard: string;
  displayName: string;
}

export type MessageContent =
  | TextContent
  | MediaContent
  | ReactionContent
  | StickerContent
  | LocationContent
  | ContactContent;

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
  /** Invite code (if available) */
  inviteCode?: string;
}

/**
 * Contact information
 */
export interface Contact {
  /** Contact JID */
  id: string;
  /** Contact name (push name) */
  name?: string;
  /** Contact short name */
  shortName?: string;
  /** Whether this is a business account */
  isBusiness?: boolean;
  /** Whether this contact is blocked */
  isBlocked?: boolean;
}

/**
 * Chat information
 */
export interface Chat {
  /** Chat JID */
  id: string;
  /** Chat name */
  name: string;
  /** Whether this is a group chat */
  isGroup: boolean;
  /** Unread message count */
  unreadCount?: number;
  /** Last message timestamp */
  lastMessageTimestamp?: number;
  /** Whether chat is archived */
  isArchived?: boolean;
  /** Whether chat is muted */
  isMuted?: boolean;
}

/**
 * Presence/typing status types
 */
export type PresenceType =
  | "available"
  | "unavailable"
  | "composing"
  | "recording"
  | "paused";

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
  sendMessage(
    jid: string,
    content: MessageContent,
    options?: SendMessageOptions,
  ): Promise<SendResult>;

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
   * Set group message permissions (admins only)
   * Optional: may not be supported by all adapters.
   */
  setMessagesAdminsOnly?(chatId: string, enabled: boolean): Promise<void>;

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

  // ============================================
  // Extended Features (Optional - may throw if not supported)
  // ============================================

  /**
   * Get profile picture URL for a contact or group
   * @param jid - The JID to get profile picture for
   */
  getProfilePicUrl?(jid: string): Promise<string | null>;

  /**
   * Send presence update (typing, online, etc.)
   * @param type - The presence type
   * @param jid - Optional JID to send presence to (for typing indicators)
   */
  sendPresenceUpdate?(type: PresenceType, jid?: string): Promise<void>;

  /**
   * Mark messages as read
   * @param jid - The chat JID
   * @param messageIds - Optional specific message IDs to mark as read
   */
  sendSeen?(jid: string, messageIds?: string[]): Promise<void>;

  /**
   * Forward a message to another chat
   * @param jid - The destination chat JID
   * @param message - The message to forward
   */
  forwardMessage?(jid: string, message: WAMessage): Promise<SendResult>;

  /**
   * Download media from a message
   * @param message - The message containing media
   */
  downloadMedia?(message: WAMessage): Promise<Buffer>;

  /**
   * Create a new group
   * @param name - Group name
   * @param participants - Array of participant JIDs
   */
  createGroup?(name: string, participants: string[]): Promise<GroupMetadata>;

  /**
   * Add participants to a group
   * @param groupId - The group JID
   * @param participants - Array of participant JIDs to add
   */
  addParticipants?(groupId: string, participants: string[]): Promise<void>;

  /**
   * Remove participants from a group
   * @param groupId - The group JID
   * @param participants - Array of participant JIDs to remove
   */
  removeParticipants?(groupId: string, participants: string[]): Promise<void>;

  /**
   * Promote participants to admin in a group
   * @param groupId - The group JID
   * @param participants - Array of participant JIDs to promote
   */
  promoteParticipants?(groupId: string, participants: string[]): Promise<void>;

  /**
   * Demote admins in a group
   * @param groupId - The group JID
   * @param participants - Array of participant JIDs to demote
   */
  demoteParticipants?(groupId: string, participants: string[]): Promise<void>;

  /**
   * Update group subject/name
   * @param groupId - The group JID
   * @param subject - New group name
   */
  setGroupSubject?(groupId: string, subject: string): Promise<void>;

  /**
   * Update group description
   * @param groupId - The group JID
   * @param description - New group description
   */
  setGroupDescription?(groupId: string, description: string): Promise<void>;

  /**
   * Leave a group
   * @param groupId - The group JID
   */
  leaveGroup?(groupId: string): Promise<void>;

  /**
   * Get group invite code
   * @param groupId - The group JID
   */
  getInviteCode?(groupId: string): Promise<string>;

  /**
   * Accept a group invite
   * @param inviteCode - The invite code
   */
  acceptInvite?(inviteCode: string): Promise<string>;

  /**
   * Block a contact
   * @param jid - The contact JID to block
   */
  blockContact?(jid: string): Promise<void>;

  /**
   * Unblock a contact
   * @param jid - The contact JID to unblock
   */
  unblockContact?(jid: string): Promise<void>;

  /**
   * Get list of blocked contacts
   */
  getBlockedContacts?(): Promise<string[]>;
}

/**
 * Library type for the adapter factory
 */
export type WhatsAppLibrary = "baileys" | "wwebjs";
