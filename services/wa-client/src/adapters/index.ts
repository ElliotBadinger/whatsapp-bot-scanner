/**
 * WhatsApp Adapters Module
 *
 * This module exports all adapter-related types and implementations.
 */

// Types
export * from "./types.js";

// Adapters
export { BaileysAdapter, baileysSessionExists } from "./baileys-adapter.js";
export {
  WWebJSAdapter,
  wwebjsSessionExists,
  type WWebJSAdapterConfig,
} from "./wwebjs-adapter.js";

// Factory
export {
  createWhatsAppAdapter,
  createAdapterFromEnv,
  getConfiguredLibrary,
  LIBRARY_INFO,
  type FactoryConfig,
} from "./factory.js";
