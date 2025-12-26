/**
 * Shared Message Handler
 *
 * This module provides a unified message handling layer that works with
 * both Baileys and whatsapp-web.js adapters through the WhatsAppAdapter interface.
 */

import type { Logger } from "pino";
import type { Redis } from "ioredis";
import {
  type WhatsAppAdapter,
  type WAMessage,
  type MessageHandler as AdapterMessageHandler,
} from "../adapters/types.js";
import {
  extractUrls,
  normalizeUrl,
  urlHash,
  isPrivateHostname,
  config,
  metrics,
  hashChatId,
  hashMessageId,
} from "@wbscanner/shared";
import type { ScanRequestQueue } from "../types/scanQueue.js";

/**
 * Configuration for the message handler
 */
export interface MessageHandlerConfig {
  /** WhatsApp adapter instance */
  adapter: WhatsAppAdapter;
  /** Redis client */
  redis: Redis;
  /** Logger instance */
  logger: Logger;
  /** Scan request queue */
  scanRequestQueue: ScanRequestQueue;
  /** Whether to process messages from self */
  processOwnMessages?: boolean;
}

/**
 * Context for processing a message
 */
interface MessageContext {
  message: WAMessage;
  urls: string[];
  isCommand: boolean;
  command?: string;
  args?: string[];
}

/**
 * Command handler function type
 */
type CommandHandler = (
  ctx: MessageContext,
  adapter: WhatsAppAdapter,
  logger: Logger,
) => Promise<void>;

/**
 * Shared message handler class
 */
export class SharedMessageHandler {
  private adapter: WhatsAppAdapter;
  private redis: Redis;
  private logger: Logger;
  private scanRequestQueue: ScanRequestQueue;
  private processOwnMessages: boolean;
  private commandHandlers: Map<string, CommandHandler> = new Map();

  private consentStatusKey(chatId: string): string {
    return `wa:consent:status:${hashChatId(chatId)}`;
  }

  private legacyConsentStatusKey(chatId: string): string {
    return `wa:consent:status:${chatId}`;
  }

  private consentPendingSetKey(): string {
    return "wa:consent:pending";
  }

  private async refreshConsentGauge(): Promise<void> {
    try {
      const pending = await this.redis.scard(this.consentPendingSetKey());
      metrics.waConsentGauge.set(pending);
    } catch {
      // ignore
    }
  }

  private async markConsentGranted(chatId: string): Promise<void> {
    await this.redis.set(
      this.consentStatusKey(chatId),
      "granted",
      "EX",
      config.wa.messageLineageTtlSeconds,
    );
    await this.redis.del(this.legacyConsentStatusKey(chatId));
    const chatIdHash = hashChatId(chatId);
    await this.redis.srem(this.consentPendingSetKey(), chatIdHash);
    await this.redis.srem(this.consentPendingSetKey(), chatId);
    metrics.waGovernanceActions.labels("consent_granted").inc();
    await this.refreshConsentGauge();
  }

  private async getConsentStatus(
    chatId: string,
  ): Promise<"pending" | "granted" | null> {
    let status = await this.redis.get(this.consentStatusKey(chatId));
    if (!status) {
      status = await this.redis.get(this.legacyConsentStatusKey(chatId));
      if (status) {
        await this.redis.set(
          this.consentStatusKey(chatId),
          status,
          "EX",
          config.wa.messageLineageTtlSeconds,
        );
        await this.redis.del(this.legacyConsentStatusKey(chatId));
      }
    }
    return status === "pending" || status === "granted" ? status : null;
  }

  private async replyWithLatency(
    message: WAMessage,
    content: Parameters<WhatsAppAdapter["reply"]>[1],
  ): Promise<void> {
    await this.adapter.reply(message, content);
    const latencySeconds = Math.max(0, (Date.now() - message.timestamp) / 1000);
    metrics.waResponseLatency.observe(latencySeconds);
  }

  constructor(config: MessageHandlerConfig) {
    this.adapter = config.adapter;
    this.redis = config.redis;
    this.logger = config.logger.child({ component: "message-handler" });
    this.scanRequestQueue = config.scanRequestQueue;
    this.processOwnMessages = config.processOwnMessages ?? false;

    // Register default command handlers
    this.registerDefaultCommands();
  }

  /**
   * Register default bot commands
   */
  private registerDefaultCommands(): void {
    // Help command
    this.registerCommand("help", async (ctx) => {
      const helpText = [
        "*WBScanner Bot Commands*",
        "",
        "!scanner help - Show this help message",
        "!scanner status - Show bot status",
        "!scanner scan <url> - Manually scan a URL",
        "!scanner consent - Mark group consent as granted",
        "!scanner consentstatus - Show group consent status",
        "",
        "_Links shared in this chat are automatically scanned._",
      ].join("\n");

      await this.replyWithLatency(ctx.message, {
        type: "text",
        text: helpText,
      });
    });

    // Status command
    this.registerCommand("status", async (ctx, adapter) => {
      const statusText = [
        "*WBScanner Status*",
        "",
        `State: ${adapter.state}`,
        `Bot ID: ${adapter.botId ?? "Unknown"}`,
        `Library: ${process.env.WA_LIBRARY ?? "baileys"}`,
      ].join("\n");

      await this.replyWithLatency(ctx.message, {
        type: "text",
        text: statusText,
      });
    });

    // Manual scan command
    this.registerCommand("scan", async (ctx, _adapter, logger) => {
      if (!ctx.args || ctx.args.length === 0) {
        await this.replyWithLatency(ctx.message, {
          type: "text",
          text: "Usage: !scanner scan <url>",
        });
        return;
      }

      const url = ctx.args[0];
      try {
        const normalized =
          normalizeUrl(url) ??
          (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)
            ? null
            : normalizeUrl(`https://${url}`));
        if (!normalized) {
          await this.replyWithLatency(ctx.message, {
            type: "text",
            text: "Invalid URL format.",
          });
          return;
        }

        // Check if URL is private/internal
        const parsed = new URL(normalized);
        if (await isPrivateHostname(parsed.hostname)) {
          await this.replyWithLatency(ctx.message, {
            type: "text",
            text: "Cannot scan private/internal URLs.",
          });
          return;
        }

        // Queue the scan
        const hash = urlHash(normalized);
        await this.scanRequestQueue.add("scan", {
          url: normalized,
          urlHash: hash,
          chatId: ctx.message.chatId,
          messageId: ctx.message.id,
          senderId: ctx.message.senderId,
          timestamp: Date.now(),
          manual: true,
        });

        await this.replyWithLatency(ctx.message, {
          type: "text",
          text: `Scanning: ${normalized}`,
        });

        logger.info({ url: normalized, hash }, "Manual scan queued");
      } catch (err) {
        logger.error({ err, url }, "Failed to queue manual scan");
        await this.replyWithLatency(ctx.message, {
          type: "text",
          text: "Failed to queue scan. Please try again.",
        });
      }
    });

    this.registerCommand("consent", async (ctx, adapter) => {
      if (!config.wa.consentOnJoin) {
        await this.replyWithLatency(ctx.message, {
          type: "text",
          text: "Consent enforcement is currently disabled.",
        });
        return;
      }

      await this.markConsentGranted(ctx.message.chatId);
      metrics.waGroupEvents.labels("consent_granted").inc();

      const setMessagesAdminsOnly = adapter.setMessagesAdminsOnly;
      if (ctx.message.isGroup && setMessagesAdminsOnly) {
        await setMessagesAdminsOnly(ctx.message.chatId, false);
      }

      await this.replyWithLatency(ctx.message, {
        type: "text",
        text: "Consent recorded. Automated scanning enabled for this group.",
      });
    });

    this.registerCommand("consentstatus", async (ctx) => {
      const status =
        (await this.getConsentStatus(ctx.message.chatId)) ?? "none";
      await this.replyWithLatency(ctx.message, {
        type: "text",
        text: `Consent status: ${status}`,
      });
    });
  }

  /**
   * Register a custom command handler
   */
  registerCommand(command: string, handler: CommandHandler): void {
    this.commandHandlers.set(command.toLowerCase(), handler);
  }

  /**
   * Create the message handler function for the adapter
   */
  createHandler(): AdapterMessageHandler {
    return async (message: WAMessage) => {
      try {
        await this.handleMessage(message);
      } catch (err) {
        this.logger.error(
          { err, messageIdHash: hashMessageId(message.id) },
          "Message handler error",
        );
      }
    };
  }

  /**
   * Handle an incoming message
   */
  private async handleMessage(message: WAMessage): Promise<void> {
    // Skip own messages unless configured to process them
    if (message.fromMe && !this.processOwnMessages) {
      return;
    }

    // Skip empty messages
    if (!message.body || message.body.trim().length === 0) {
      return;
    }

    // Persist message timestamp so downstream verdict delivery can compute
    // true end-to-end response latency.
    const timestampKey = `wa:msg_ts:${hashChatId(message.chatId)}:${hashMessageId(
      message.id,
    )}`;
    await this.redis
      .set(
        timestampKey,
        String(message.timestamp),
        "EX",
        config.wa.messageLineageTtlSeconds,
      )
      .catch(() => undefined);

    // Parse message context
    const ctx = this.parseMessageContext(message);

    // Handle commands
    if (ctx.isCommand && ctx.command) {
      await this.handleCommand(ctx);
      return;
    }

    // Handle URLs in message
    if (ctx.urls.length > 0) {
      await this.handleUrls(ctx);
    }
  }

  /**
   * Parse message into context
   */
  private parseMessageContext(message: WAMessage): MessageContext {
    const body = message.body.trim();
    const urls = extractUrls(body);

    // Check for bot command
    const commandMatch = body.match(/^!scanner\s+(\w+)(?:\s+(.*))?$/i);
    if (commandMatch) {
      const command = commandMatch[1].toLowerCase();
      const argsStr = commandMatch[2]?.trim() ?? "";
      const args = argsStr ? argsStr.split(/\s+/) : [];

      return {
        message,
        urls,
        isCommand: true,
        command,
        args,
      };
    }

    return {
      message,
      urls,
      isCommand: false,
    };
  }

  /**
   * Handle a bot command
   */
  private async handleCommand(ctx: MessageContext): Promise<void> {
    if (!ctx.command) return;

    const handler = this.commandHandlers.get(ctx.command);
    if (handler) {
      this.logger.info(
        { command: ctx.command, chatId: ctx.message.chatId },
        "Executing command",
      );
      // Track command execution (metric may not exist in all configurations)
      await handler(ctx, this.adapter, this.logger);
    } else {
      await this.replyWithLatency(ctx.message, {
        type: "text",
        text: `Unknown command: ${ctx.command}. Use !scanner help for available commands.`,
      });
    }
  }

  /**
   * Handle URLs found in message
   */
  private async handleUrls(ctx: MessageContext): Promise<void> {
    const { message, urls } = ctx;

    for (const url of urls) {
      try {
        const normalized = normalizeUrl(url);
        if (!normalized) {
          this.logger.debug({ url }, "Skipping invalid URL");
          continue;
        }

        // Check if URL is private/internal
        const parsed = new URL(normalized);
        if (await isPrivateHostname(parsed.hostname)) {
          this.logger.debug({ url: normalized }, "Skipping private URL");
          continue;
        }

        // Check for duplicate processing
        const hash = urlHash(normalized);
        const processedKey = `processed:${hashChatId(message.chatId)}:${hashMessageId(
          message.id,
        )}:${hash}`;
        const alreadyProcessed = await this.redis.exists(processedKey);
        if (alreadyProcessed) {
          this.logger.debug({ url: normalized, hash }, "URL already processed");
          continue;
        }

        // Mark as processed
        await this.redis.set(
          processedKey,
          "1",
          "EX",
          config.wa.messageLineageTtlSeconds,
        );

        // Queue the scan
        await this.scanRequestQueue.add("scan", {
          url: normalized,
          urlHash: hash,
          chatId: message.chatId,
          messageId: message.id,
          senderId: message.senderId,
          timestamp: message.timestamp,
          isGroup: message.isGroup,
        });

        this.logger.info(
          { url: normalized, hash, chatId: message.chatId },
          "URL queued for scanning",
        );
        metrics.ingestionRate.inc();
      } catch (err) {
        this.logger.warn({ err, url }, "Failed to process URL");
      }
    }
  }

  /**
   * Start listening for messages
   */
  start(): void {
    this.adapter.onMessage(this.createHandler());
    this.logger.info("Message handler started");
  }
}

/**
 * Create a shared message handler
 */
export function createMessageHandler(
  config: MessageHandlerConfig,
): SharedMessageHandler {
  return new SharedMessageHandler(config);
}
