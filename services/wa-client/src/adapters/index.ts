/**
 * WhatsApp Adapters Module
 *
 * This module exports all adapter-related types and implementations.
 */

// Types
export * from "./types";

// Adapters
export { BaileysAdapter, baileysSessionExists } from "./baileys-adapter";
export {
  WWebJSAdapter,
  wwebjsSessionExists,
  type WWebJSAdapterConfig,
} from "./wwebjs-adapter";

// Factory
export {
  createWhatsAppAdapter,
  createAdapterFromEnv,
  getConfiguredLibrary,
  LIBRARY_INFO,
  type FactoryConfig,
} from "./factory";
