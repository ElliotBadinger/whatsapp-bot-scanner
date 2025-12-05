/**
 * WhatsApp Adapters Module
 *
 * This module exports adapter-related types and factory functions.
 * 
 * Note: Adapter classes (BaileysAdapter, WWebJSAdapter) are NOT directly exported
 * to support conditional loading. Use the factory functions instead:
 *   - createAdapterFromEnv() - Creates adapter based on WA_LIBRARY env var
 *   - createWhatsAppAdapter() - Creates adapter with explicit configuration
 */

// Types
export * from "./types.js";

// Factory (adapters are loaded dynamically to avoid importing unused modules)
export {
  createWhatsAppAdapter,
  createAdapterFromEnv,
  getConfiguredLibrary,
  LIBRARY_INFO,
  type FactoryConfig,
} from "./factory.js";
