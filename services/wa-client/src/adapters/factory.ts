/**
 * WhatsApp Adapter Factory
 *
 * This module provides a factory function to create the appropriate WhatsApp adapter
 * based on configuration. Users can choose between Baileys (recommended) and
 * whatsapp-web.js (legacy) libraries.
 */

import type { Logger } from "pino";
import type { Redis } from "ioredis";

import {
  type WhatsAppAdapter,
  type AdapterConfig,
  type WhatsAppLibrary,
} from "./types.js";
import { BaileysAdapter } from "./baileys-adapter.js";
import { WWebJSAdapter, type WWebJSAdapterConfig } from "./wwebjs-adapter.js";
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
  /** Phone number for pairing (optional) */
  phoneNumber?: string;
  /** Whether to print QR code to terminal */
  printQRInTerminal?: boolean;
  /** Data path for session storage */
  dataPath?: string;
  /** Browser name to show in WhatsApp */
  browserName?: string;
  /** WWebJS-specific: Use RemoteAuth instead of LocalAuth */
  useRemoteAuth?: boolean;
  /** WWebJS-specific: Puppeteer launch arguments */
  puppeteerArgs?: string[];
}

/**
 * Get the configured WhatsApp library from environment
 */
export function getConfiguredLibrary(): WhatsAppLibrary {
  const envLibrary = process.env.WA_LIBRARY?.toLowerCase();

  if (envLibrary === "wwebjs" || envLibrary === "whatsapp-web.js") {
    return "wwebjs";
  }

  // Default to Baileys (recommended)
  return "baileys";
}

/**
 * Create a WhatsApp adapter based on configuration
 *
 * @param config - Factory configuration
 * @returns WhatsApp adapter instance
 */
export function createWhatsAppAdapter(config: FactoryConfig): WhatsAppAdapter {
  const { library, logger } = config;

  logger.info({ library }, "Creating WhatsApp adapter");

  switch (library) {
    case "baileys": {
      const adapterConfig: AdapterConfig = {
        redis: config.redis,
        logger: config.logger,
        clientId: config.clientId,
        phoneNumber: config.phoneNumber,
        printQRInTerminal: config.printQRInTerminal ?? true,
        dataPath: config.dataPath,
        browserName: config.browserName ?? "WBScanner",
      };
      return new BaileysAdapter(adapterConfig);
    }

    case "wwebjs": {
      const adapterConfig: WWebJSAdapterConfig = {
        redis: config.redis,
        logger: config.logger,
        clientId: config.clientId,
        phoneNumber: config.phoneNumber,
        printQRInTerminal: config.printQRInTerminal ?? true,
        dataPath: config.dataPath,
        browserName: config.browserName,
        useRemoteAuth:
          config.useRemoteAuth ?? appConfig.wa.authStrategy === "remote",
        puppeteerArgs: config.puppeteerArgs,
      };
      return new WWebJSAdapter(adapterConfig);
    }

    default:
      throw new Error(
        `Unknown WhatsApp library: ${library}. Supported: baileys, wwebjs`,
      );
  }
}

/**
 * Create a WhatsApp adapter using environment configuration
 *
 * @param redis - Redis client
 * @param logger - Logger instance
 * @returns WhatsApp adapter instance
 */
export function createAdapterFromEnv(
  redis: Redis,
  logger: Logger,
): WhatsAppAdapter {
  const library = getConfiguredLibrary();

  return createWhatsAppAdapter({
    library,
    redis,
    logger,
    clientId: appConfig.wa.remoteAuth.clientId || "default",
    phoneNumber: appConfig.wa.remoteAuth.phoneNumbers?.[0],
    printQRInTerminal: !appConfig.wa.remoteAuth.disableQrFallback,
    dataPath: appConfig.wa.remoteAuth.dataPath,
    browserName: "WBScanner",
    useRemoteAuth: appConfig.wa.authStrategy === "remote",
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
  wwebjs: {
    name: "whatsapp-web.js",
    description: "Browser-based, higher resource usage (~500MB RAM)",
    recommended: false,
  },
} as const;
