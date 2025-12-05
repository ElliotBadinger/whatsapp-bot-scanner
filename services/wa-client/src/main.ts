/**
 * WA Client Main Entry Point (Adapter-based)
 *
 * This is the new entry point that uses the adapter pattern to support
 * both Baileys and whatsapp-web.js libraries. Set WA_LIBRARY environment
 * variable to choose the library:
 *
 *   WA_LIBRARY=baileys   - Use Baileys (recommended, default)
 *   WA_LIBRARY=wwebjs    - Use whatsapp-web.js (legacy)
 *
 * For the legacy whatsapp-web.js-only entry point, use index.ts.
 */

import Fastify from "fastify";
import { Queue } from "bullmq";

import {
  config,
  logger,
  register,
  assertEssentialConfig,
  assertControlPlaneToken,
  createRedisConnection,
  connectRedis,
} from "@wbscanner/shared";

import {
  createAdapterFromEnv,
  getConfiguredLibrary,
  LIBRARY_INFO,
  type WhatsAppAdapter,
} from "./adapters/index.js";
import { createMessageHandler } from "./handlers/index.js";

// Global state
let adapter: WhatsAppAdapter | null = null;
let scanRequestQueue: Queue | null = null;

/**
 * Graceful shutdown handler
 */
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Received shutdown signal");

  try {
    if (adapter) {
      await adapter.disconnect();
    }
    if (scanRequestQueue) {
      await scanRequestQueue.close();
    }
    logger.info("Graceful shutdown complete");
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "Error during shutdown");
    process.exit(1);
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  // Validate configuration
  assertEssentialConfig("wa-client");
  assertControlPlaneToken();

  // Log library selection
  const library = getConfiguredLibrary();
  const libraryInfo = LIBRARY_INFO[library];
  logger.info(
    { library, name: libraryInfo.name, recommended: libraryInfo.recommended },
    "Starting WA Client with adapter",
  );

  // Connect to Redis
  const redis = createRedisConnection();
  try {
    await connectRedis(redis, "wa-client");
  } catch (err) {
    logger.error({ err }, "Failed to connect to Redis. Exiting...");
    process.exit(1);
  }

  // Create scan request queue
  scanRequestQueue = new Queue(config.queues.scanRequest, {
    connection: redis,
  });

  // Create WhatsApp adapter (async to support dynamic imports)
  adapter = await createAdapterFromEnv(redis, logger);

  // Set up connection handlers
  adapter.onConnectionChange((state) => {
    logger.info({ state }, "Connection state changed");
    // Connection state metric (if available)
  });

  adapter.onDisconnect((reason) => {
    logger.warn({ reason }, "Disconnected from WhatsApp");
    if (reason.shouldReconnect) {
      logger.info("Will attempt to reconnect...");
    }
  });

  adapter.onQRCode((qr) => {
    logger.info("QR code received - scan with WhatsApp to authenticate");
    // Print QR to terminal if configured
    if (config.wa.remoteAuth.disableQrFallback !== true) {
      import("qrcode-terminal").then((qrTerminal) => {
        qrTerminal.generate(qr, { small: true });
      });
    }
  });

  adapter.onPairingCode((code) => {
    logger.info(
      { code },
      "Pairing code received - enter in WhatsApp > Linked Devices",
    );
  });

  // Create and start message handler
  const messageHandler = createMessageHandler({
    adapter,
    redis,
    logger,
    scanRequestQueue,
  });
  messageHandler.start();

  // Create Fastify server for health checks and metrics
  const server = Fastify({ logger: false });

  // Health check endpoint (both /health and /healthz for compatibility)
  const healthHandler = async () => {
    return {
      status: adapter?.state === "ready" ? "healthy" : "degraded",
      library,
      state: adapter?.state ?? "unknown",
      botId: adapter?.botId ?? null,
    };
  };
  server.get("/health", healthHandler);
  server.get("/healthz", healthHandler);

  // Metrics endpoint
  server.get("/metrics", async (_, reply) => {
    reply.header("Content-Type", register.contentType);
    return register.metrics();
  });

  // Library info endpoint
  server.get("/library", async () => {
    return {
      current: library,
      info: libraryInfo,
      available: LIBRARY_INFO,
    };
  });

  // Pairing code request endpoint
  server.post<{
    Body?: { phoneNumber?: string };
    Reply: {
      success: boolean;
      code?: string;
      error?: string;
      qrAvailable?: boolean;
    };
  }>("/pair", async (request, reply) => {
    if (!adapter) {
      return reply.status(503).send({
        success: false,
        error: "WhatsApp adapter not initialized",
      });
    }

    // Get phone number from request body or environment
    let phoneNumber =
      request.body?.phoneNumber ??
      process.env.WA_REMOTE_AUTH_PHONE_NUMBERS?.split(",")[0]?.trim() ??
      process.env.WA_REMOTE_AUTH_PHONE_NUMBER;

    if (!phoneNumber) {
      return reply.status(400).send({
        success: false,
        error:
          "Phone number required. Set WA_REMOTE_AUTH_PHONE_NUMBERS in .env or provide phoneNumber in request body",
        qrAvailable: true, // QR code is available as alternative
      });
    }

    // Clean the phone number (remove non-digits except leading +)
    phoneNumber = phoneNumber.replaceAll(/[^\d+]/g, "").replace(/^\+/, "");

    try {
      const code = await adapter.requestPairingCode(phoneNumber);
      logger.info(
        { phoneNumber: phoneNumber.slice(-4) },
        "Pairing code requested successfully",
      );
      return { success: true, code };
    } catch (err) {
      const error = err as Error;
      logger.error(
        { err, phoneNumber: phoneNumber.slice(-4) },
        "Failed to request pairing code",
      );

      // Check for rate limiting
      if (error.message?.includes("rate") || error.message?.includes("429")) {
        return reply.status(429).send({
          success: false,
          error: "Rate limited by WhatsApp. Wait 15 minutes before retrying.",
          qrAvailable: true,
        });
      }

      return reply.status(500).send({
        success: false,
        error: error.message || "Failed to request pairing code",
        qrAvailable: true,
      });
    }
  });

  // QR code endpoint (returns current QR if available)
  server.get<{
    Reply: { success: boolean; qr?: string; state?: string; error?: string };
  }>("/qr", async (_, reply) => {
    if (!adapter) {
      return reply.status(503).send({
        success: false,
        error: "WhatsApp adapter not initialized",
      });
    }

    // The QR is emitted via event; we can't directly get it
    // This endpoint is for checking state and giving guidance
    const state = adapter.state;

    if (state === "ready") {
      return { success: true, state, error: "Already connected, no QR needed" };
    }

    return {
      success: true,
      state,
      error:
        state === "connecting"
          ? "Connecting... watch terminal for QR code or use /pair for pairing code"
          : "Not connected. Restart wa-client to generate new QR code",
    };
  });

  // Connection state endpoint
  server.get("/state", async () => {
    return {
      state: adapter?.state ?? "unknown",
      botId: adapter?.botId ?? null,
      library,
    };
  });

  // Start HTTP server
  const port = Number.parseInt(process.env.WA_HTTP_PORT ?? "3001", 10);
  await server.listen({ port, host: "0.0.0.0" });
  logger.info({ port }, "HTTP server started");

  // Connect to WhatsApp
  logger.info("Connecting to WhatsApp...");
  await adapter.connect();

  // Register shutdown handlers
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  logger.info("WA Client started successfully");
}

// Run main
try {
  await main();
} catch (err) {
  logger.error({ err }, "Fatal error in main");
  process.exit(1);
}
