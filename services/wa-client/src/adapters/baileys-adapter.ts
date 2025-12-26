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
  downloadMediaMessage,
  generateForwardMessageContent,
  type WASocket,
  type proto as BaileysProto,
  type WAMessage as BaileysWAMessage,
  type WAPresence,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import type { Logger } from "pino";

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
  type PresenceType,
} from "./types.js";
import {
  useRedisAuthState,
  sessionExists,
} from "../auth/baileys-auth-store.js";

/**
 * Baileys implementation of the WhatsAppAdapter interface
 */
export class BaileysAdapter implements WhatsAppAdapter {
  private socket: WASocket | null = null;
  private readonly config: AdapterConfig;
  private readonly logger: Logger;
  private _state: ConnectionState = "disconnected";
  private _botId: string | null = null;

  // Event handlers
  private readonly messageHandlers: MessageHandler[] = [];
  private readonly connectionHandlers: ConnectionHandler[] = [];
  private readonly disconnectHandlers: DisconnectHandler[] = [];
  private readonly qrCodeHandlers: QRCodeHandler[] = [];
  private readonly pairingCodeHandlers: PairingCodeHandler[] = [];

  // Auth state management
  private saveCreds: (() => Promise<void>) | null = null;
  private clearState: (() => Promise<void>) | null = null;

  constructor(config: AdapterConfig) {
    this.config = config;
    this.logger = config.logger.child({ adapter: "baileys" });
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
      this.logger.warn("Socket already exists, disconnecting first");
      await this.disconnect();
    }

    this.setState("connecting");

    try {
      // Initialize Redis auth state
      const {
        state: authState,
        saveCreds,
        clearState,
      } = await useRedisAuthState({
        redis: this.config.redis,
        logger: this.logger,
        prefix: "baileys:auth",
        clientId: this.config.clientId,
      });

      this.saveCreds = saveCreds;
      this.clearState = clearState;

      // Fetch latest Baileys version
      const { version, isLatest } = await fetchLatestBaileysVersion();
      this.logger.info({ version, isLatest }, "Using Baileys version");

      // Create the socket
      this.socket = makeWASocket({
        version,
        auth: {
          creds: authState.creds,
          keys: makeCacheableSignalKeyStore(authState.keys, this.logger),
        },
        logger: this.logger,
        browser: [this.config.browserName ?? "WBScanner", "Chrome", "120.0.0"],
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
        markOnlineOnConnect: false,
      });

      // Set up event handlers
      this.setupEventHandlers();

      this.logger.info("Baileys socket created, waiting for connection");
    } catch (err) {
      this.logger.error({ err }, "Failed to create Baileys socket");
      this.setState("disconnected");
      throw err;
    }
  }

  /**
   * Set up Baileys event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Connection state updates
    this.socket.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // Handle QR code
      if (qr) {
        this.logger.info("QR code received");
        for (const handler of this.qrCodeHandlers) {
          handler(qr);
        }
      }

      // Handle connection state changes
      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const isLoggedOut = statusCode === BaileysDisconnectReason.loggedOut;
        const shouldReconnect = !isLoggedOut;

        const reason: DisconnectReason = {
          code: statusCode ?? 0,
          message: (lastDisconnect?.error as Error)?.message ?? "Unknown error",
          isLoggedOut,
          shouldReconnect,
        };

        this.logger.info({ reason }, "Connection closed");
        this.setState("disconnected");

        // Clear auth state if logged out
        if (isLoggedOut && this.clearState) {
          await this.clearState();
        }

        // Notify disconnect handlers
        for (const handler of this.disconnectHandlers) {
          handler(reason);
        }

        // Auto-reconnect: always reconnect to generate fresh QR/pairing code
        // Even after logout, we want to reconnect so user can re-pair
        this.logger.info(
          { shouldReconnect, isLoggedOut },
          "Attempting to reconnect for fresh pairing...",
        );
        setTimeout(() => this.connect(), isLoggedOut ? 2000 : 5000);
      } else if (connection === "open") {
        this._botId = this.socket?.user?.id ?? null;
        this.logger.info({ botId: this._botId }, "Connection opened");
        this.setState("ready");
      } else if (connection === "connecting") {
        this.setState("connecting");
      }
    });

    // Credentials update
    this.socket.ev.on("creds.update", async () => {
      if (this.saveCreds) {
        await this.saveCreds();
      }
    });

    // Message events
    this.socket.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;

      for (const msg of messages) {
        // Skip status broadcasts
        if (msg.key.remoteJid === "status@broadcast") continue;

        const waMessage = this.convertMessage(msg);
        if (!waMessage) continue;

        for (const handler of this.messageHandlers) {
          try {
            await handler(waMessage);
          } catch (err) {
            this.logger.error(
              { err, messageId: waMessage.id },
              "Message handler error",
            );
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
    if (!key?.remoteJid || !key.id) return null;

    const messageContent = msg.message;
    if (!messageContent) return null;

    // Extract text from various message types
    let body = "";
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
    const senderId = isGroup ? (key.participant ?? remoteJid) : remoteJid;

    // Extract quoted message if present
    let quotedMessage: WAMessage["quotedMessage"];
    const contextInfo = messageContent.extendedTextMessage?.contextInfo;
    if (contextInfo?.quotedMessage && contextInfo.stanzaId) {
      const quotedContent = contextInfo.quotedMessage;
      let quotedBody = "";
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

    const mentionCandidates = [
      messageContent.extendedTextMessage?.contextInfo?.mentionedJid,
      messageContent.imageMessage?.contextInfo?.mentionedJid,
      messageContent.videoMessage?.contextInfo?.mentionedJid,
      messageContent.documentMessage?.contextInfo?.mentionedJid,
      (messageContent as { contextInfo?: { mentionedJid?: string[] } })
        .contextInfo?.mentionedJid,
    ];
    const mentionedIds =
      mentionCandidates.find((candidate) => Array.isArray(candidate)) ?? [];

    return {
      id: key.id,
      chatId: remoteJid,
      senderId: jidNormalizedUser(senderId),
      body,
      isGroup,
      timestamp: (msg.messageTimestamp as number) * 1000,
      fromMe: key.fromMe ?? false,
      raw: msg,
      mentionedIds,
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
    this.setState("disconnected");
    this.logger.info("Disconnected from WhatsApp");
  }

  /**
   * Send a message
   */
  async sendMessage(
    jid: string,
    content: MessageContent,
    options?: SendMessageOptions,
  ): Promise<SendResult> {
    if (!this.socket) {
      throw new Error("Socket not connected");
    }

    let messageContent: Parameters<WASocket["sendMessage"]>[1];

    switch (content.type) {
      case "text":
        messageContent = { text: content.text };
        break;
      case "image":
        messageContent = {
          image:
            typeof content.data === "string"
              ? Buffer.from(content.data, "base64")
              : content.data,
          caption: content.caption,
          mimetype: content.mimetype,
        };
        break;
      case "video":
        messageContent = {
          video:
            typeof content.data === "string"
              ? Buffer.from(content.data, "base64")
              : content.data,
          caption: content.caption,
          mimetype: content.mimetype,
        };
        break;
      case "audio":
        messageContent = {
          audio:
            typeof content.data === "string"
              ? Buffer.from(content.data, "base64")
              : content.data,
          mimetype: content.mimetype,
        };
        break;
      case "document":
        messageContent = {
          document:
            typeof content.data === "string"
              ? Buffer.from(content.data, "base64")
              : content.data,
          mimetype: content.mimetype,
          fileName: content.filename,
        };
        break;
      case "reaction":
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
      case "sticker":
        messageContent = {
          sticker:
            typeof content.data === "string"
              ? Buffer.from(content.data, "base64")
              : content.data,
          mimetype: content.mimetype ?? "image/webp",
        };
        break;
      case "location":
        messageContent = {
          location: {
            degreesLatitude: content.latitude,
            degreesLongitude: content.longitude,
            name: content.name,
            address: content.address,
          },
        };
        break;
      case "contact":
        messageContent = {
          contacts: {
            displayName: content.displayName,
            contacts: [{ vcard: content.vcard }],
          },
        };
        break;
      default:
        throw new Error(
          `Unsupported content type: ${(content as MessageContent).type}`,
        );
    }

    const sendOptions: Parameters<WASocket["sendMessage"]>[2] = {};
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

    const result = await this.socket.sendMessage(
      jid,
      messageContent,
      sendOptions,
    );

    return {
      messageId: result?.key?.id ?? "",
      timestamp: Date.now(),
      success: !!result?.key?.id,
    };
  }

  /**
   * Reply to a message
   */
  async reply(
    message: WAMessage,
    content: MessageContent,
  ): Promise<SendResult> {
    return this.sendMessage(message.chatId, content, {
      quotedMessageId: message.id,
    });
  }

  /**
   * React to a message
   */
  async react(message: WAMessage, emoji: string): Promise<void> {
    if (!this.socket) {
      throw new Error("Socket not connected");
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
      throw new Error("Socket not connected");
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
      throw new Error("Socket not connected");
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
          isAdmin: p.admin === "admin" || p.admin === "superadmin",
          isSuperAdmin: p.admin === "superadmin",
        })),
        createdAt: metadata.creation ? metadata.creation * 1000 : undefined,
      };
    } catch (err) {
      this.logger.warn({ err, groupId }, "Failed to get group metadata");
      return null;
    }
  }

  /**
   * Check if a number is on WhatsApp
   */
  async isOnWhatsApp(phoneNumber: string): Promise<boolean> {
    if (!this.socket) {
      throw new Error("Socket not connected");
    }

    try {
      const results = await this.socket.onWhatsApp(phoneNumber);
      if (!results || results.length === 0) return false;
      return !!results[0]?.exists;
    } catch (err) {
      this.logger.warn(
        { err, phoneNumber },
        "Failed to check if number is on WhatsApp",
      );
      return false;
    }
  }

  /**
   * Request a pairing code for phone number authentication
   */
  async requestPairingCode(phoneNumber: string): Promise<string> {
    if (!this.socket) {
      throw new Error("Socket not connected");
    }

    // Remove any non-numeric characters
    const cleanNumber = phoneNumber.replaceAll(/\D/g, "");

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

  // ============================================
  // Extended Features Implementation
  // ============================================

  /**
   * Get profile picture URL for a contact or group
   */
  async getProfilePicUrl(jid: string): Promise<string | null> {
    if (!this.socket) {
      throw new Error("Socket not connected");
    }

    try {
      const url = await this.socket.profilePictureUrl(jid, "image");
      return url ?? null;
    } catch (err) {
      this.logger.debug({ err, jid }, "Failed to get profile picture URL");
      return null;
    }
  }

  /**
   * Send presence update (typing, online, etc.)
   */
  async sendPresenceUpdate(type: PresenceType, jid?: string): Promise<void> {
    if (!this.socket) {
      throw new Error("Socket not connected");
    }

    // Map our presence types to Baileys WAPresence
    const presenceMap: Record<PresenceType, WAPresence> = {
      available: "available",
      unavailable: "unavailable",
      composing: "composing",
      recording: "recording",
      paused: "paused",
    };

    await this.socket.sendPresenceUpdate(presenceMap[type], jid);
  }

  /**
   * Mark messages as read
   */
  async sendSeen(jid: string, messageIds?: string[]): Promise<void> {
    if (!this.socket) {
      throw new Error("Socket not connected");
    }

    if (messageIds && messageIds.length > 0) {
      const keys = messageIds.map((id) => ({
        remoteJid: jid,
        id,
        fromMe: false,
      }));
      await this.socket.readMessages(keys);
    } else {
      // Mark all messages in chat as read
      await this.socket.readMessages([
        { remoteJid: jid, id: "", fromMe: false },
      ]);
    }
  }

  /**
   * Forward a message to another chat
   */
  async forwardMessage(jid: string, message: WAMessage): Promise<SendResult> {
    if (!this.socket) {
      throw new Error("Socket not connected");
    }

    const rawMsg = message.raw as BaileysWAMessage;
    if (!rawMsg.message || !rawMsg.key) {
      throw new Error("Cannot forward message without content");
    }

    const forwardContent = generateForwardMessageContent(rawMsg, false);
    const result = await this.socket.sendMessage(
      jid,
      forwardContent as Parameters<WASocket["sendMessage"]>[1],
    );

    return {
      messageId: result?.key?.id ?? "",
      timestamp: Date.now(),
      success: !!result?.key?.id,
    };
  }

  /**
   * Download media from a message
   */
  async downloadMedia(message: WAMessage): Promise<Buffer> {
    if (!this.socket) {
      throw new Error("Socket not connected");
    }

    const rawMsg = message.raw as BaileysWAMessage;
    if (!rawMsg.message || !rawMsg.key) {
      throw new Error("Message has no content");
    }

    const buffer = await downloadMediaMessage(
      rawMsg,
      "buffer",
      {},
      {
        logger: this.logger,
        reuploadRequest: this.socket.updateMediaMessage,
      },
    );

    return buffer;
  }

  /**
   * Create a new group
   */
  async createGroup(
    name: string,
    participants: string[],
  ): Promise<GroupMetadata> {
    if (!this.socket) {
      throw new Error("Socket not connected");
    }

    const result = await this.socket.groupCreate(name, participants);
    return {
      id: result.id,
      name: result.subject,
      description: result.desc ?? undefined,
      owner: result.owner ?? undefined,
      participants: result.participants.map((p) => ({
        id: p.id,
        isAdmin: p.admin === "admin" || p.admin === "superadmin",
        isSuperAdmin: p.admin === "superadmin",
      })),
      createdAt: result.creation ? result.creation * 1000 : undefined,
    };
  }

  /**
   * Add participants to a group
   */
  async addParticipants(
    groupId: string,
    participants: string[],
  ): Promise<void> {
    if (!this.socket) {
      throw new Error("Socket not connected");
    }

    await this.socket.groupParticipantsUpdate(groupId, participants, "add");
  }

  /**
   * Remove participants from a group
   */
  async removeParticipants(
    groupId: string,
    participants: string[],
  ): Promise<void> {
    if (!this.socket) {
      throw new Error("Socket not connected");
    }

    await this.socket.groupParticipantsUpdate(groupId, participants, "remove");
  }

  /**
   * Promote participants to admin in a group
   */
  async promoteParticipants(
    groupId: string,
    participants: string[],
  ): Promise<void> {
    if (!this.socket) {
      throw new Error("Socket not connected");
    }

    await this.socket.groupParticipantsUpdate(groupId, participants, "promote");
  }

  /**
   * Demote admins in a group
   */
  async demoteParticipants(
    groupId: string,
    participants: string[],
  ): Promise<void> {
    if (!this.socket) {
      throw new Error("Socket not connected");
    }

    await this.socket.groupParticipantsUpdate(groupId, participants, "demote");
  }

  /**
   * Update group subject/name
   */
  async setGroupSubject(groupId: string, subject: string): Promise<void> {
    if (!this.socket) {
      throw new Error("Socket not connected");
    }

    await this.socket.groupUpdateSubject(groupId, subject);
  }

  /**
   * Update group description
   */
  async setGroupDescription(
    groupId: string,
    description: string,
  ): Promise<void> {
    if (!this.socket) {
      throw new Error("Socket not connected");
    }

    await this.socket.groupUpdateDescription(groupId, description);
  }

  /**
   * Leave a group
   */
  async leaveGroup(groupId: string): Promise<void> {
    if (!this.socket) {
      throw new Error("Socket not connected");
    }

    await this.socket.groupLeave(groupId);
  }

  /**
   * Get group invite code
   */
  async getInviteCode(groupId: string): Promise<string> {
    if (!this.socket) {
      throw new Error("Socket not connected");
    }

    const code = await this.socket.groupInviteCode(groupId);
    if (!code) {
      throw new Error("Failed to get invite code");
    }
    return code;
  }

  /**
   * Accept a group invite
   */
  async acceptInvite(inviteCode: string): Promise<string> {
    if (!this.socket) {
      throw new Error("Socket not connected");
    }

    const groupId = await this.socket.groupAcceptInvite(inviteCode);
    if (!groupId) {
      throw new Error("Failed to accept invite");
    }
    return groupId;
  }

  /**
   * Block a contact
   */
  async blockContact(jid: string): Promise<void> {
    if (!this.socket) {
      throw new Error("Socket not connected");
    }

    await this.socket.updateBlockStatus(jid, "block");
  }

  /**
   * Unblock a contact
   */
  async unblockContact(jid: string): Promise<void> {
    if (!this.socket) {
      throw new Error("Socket not connected");
    }

    await this.socket.updateBlockStatus(jid, "unblock");
  }

  /**
   * Get list of blocked contacts
   */
  async getBlockedContacts(): Promise<string[]> {
    if (!this.socket) {
      throw new Error("Socket not connected");
    }

    const blocklist = await this.socket.fetchBlocklist();
    return blocklist.filter((jid): jid is string => jid !== undefined);
  }
}

/**
 * Check if a Baileys session exists
 */
export async function baileysSessionExists(
  redis: import("ioredis").default,
  clientId: string,
): Promise<boolean> {
  return sessionExists(redis, "baileys:auth", clientId);
}
