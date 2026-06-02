/**
 * WhatsApp Adapter Factory
 *
 * Creates the Baileys WhatsApp adapter. The adapter interface lives in
 * ./types.ts; Baileys is currently the only supported library (the legacy
 * whatsapp-web.js adapter was removed to keep the MVP lightweight — no
 * Chromium/Puppeteer dependency).
 */

import type { Logger } from "pino";
import type { Redis } from "ioredis";

import {
  type WhatsAppAdapter,
  type AdapterConfig,
  type WhatsAppLibrary,
} from "./types.js";
import { config as appConfig } from "@wbscanner/shared";

/**
 * Extended factory configuration
 */
export interface FactoryConfig {
  /** Which WhatsApp library to use */
  library: WhatsAppLibrary;
  /** Redis client for session storage */
  redis: Redis;
  /** Logger instance */
  logger: Logger;
  /** Session/client ID */
  clientId: string;
  /** Auth store strategy. */
  authStore?: "redis" | "file";
  /** Phone number for pairing (optional) */
  phoneNumber?: string;
  /** Whether to print QR code to terminal */
  printQRInTerminal?: boolean;
  /** Data path for session storage */
  dataPath?: string;
  /** Browser name to show in WhatsApp */
  browserName?: string;
}

/**
 * Get the configured WhatsApp library. Baileys is the only supported option.
 */
export function getConfiguredLibrary(): WhatsAppLibrary {
  return "baileys";
}

/**
 * Create a WhatsApp adapter based on configuration
 *
 * @param config - Factory configuration
 * @returns WhatsApp adapter instance
 */
export async function createWhatsAppAdapter(
  config: FactoryConfig,
): Promise<WhatsAppAdapter> {
  const { library, logger } = config;

  logger.info({ library }, "Creating WhatsApp adapter");

  // Dynamic import keeps the adapter module off the startup path until needed.
  const { BaileysAdapter } = await import("./baileys-adapter.js");
  const adapterConfig: AdapterConfig = {
    redis: config.redis,
    logger: config.logger,
    clientId: config.clientId,
    authStore: config.authStore,
    phoneNumber: config.phoneNumber,
    printQRInTerminal: false,
    dataPath: config.dataPath,
    browserName: config.browserName ?? "WBScanner",
  };
  return new BaileysAdapter(adapterConfig);
}

/**
 * Create a WhatsApp adapter using environment configuration
 *
 * @param redis - Redis client
 * @param logger - Logger instance
 * @returns WhatsApp adapter instance
 */
export async function createAdapterFromEnv(
  redis: Redis,
  logger: Logger,
  overrides?: Pick<FactoryConfig, "authStore">,
): Promise<WhatsAppAdapter> {
  const library = getConfiguredLibrary();

  return createWhatsAppAdapter({
    library,
    redis,
    logger,
    clientId: appConfig.wa.remoteAuth.clientId || "default",
    authStore: overrides?.authStore,
    phoneNumber: appConfig.wa.remoteAuth.phoneNumbers?.[0],
    printQRInTerminal: !appConfig.wa.remoteAuth.disableQrFallback,
    dataPath: appConfig.wa.remoteAuth.dataPath,
    browserName: "WBScanner",
  });
}

/**
 * Library information for display purposes
 */
export const LIBRARY_INFO = {
  baileys: {
    name: "Baileys",
    description: "Protocol-based, lightweight (~50MB RAM)",
    recommended: true,
  },
} as const;
