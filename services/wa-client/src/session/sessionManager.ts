import { Logger } from "pino";
import Redis from "ioredis";
import { config } from "@wbscanner/shared";
import { forceRemoteSessionReset } from "./cleanup";
import { createRemoteAuthStore } from "../remoteAuthStore";
import { loadEncryptionMaterials } from "../crypto/dataKeyProvider";

export class SessionManager {
  constructor(
    private redis: Redis,
    private logger: Logger,
  ) {}

  async clearSession(reason: string): Promise<void> {
    if (config.wa.authStrategy !== "remote") {
      this.logger.info("Skipping session clear (not using RemoteAuth)");
      return;
    }

    this.logger.warn(
      { reason },
      "Clearing invalid RemoteAuth session to trigger re-pairing",
    );

    try {
      const materials = await loadEncryptionMaterials(
        config.wa.remoteAuth,
        this.logger,
      );
      const store = createRemoteAuthStore({
        redis: this.redis,
        logger: this.logger,
        prefix: `remoteauth:v1:${config.wa.remoteAuth.clientId}`,
        materials,
        clientId: config.wa.remoteAuth.clientId,
      });

      const sessionName = config.wa.remoteAuth.clientId
        ? `RemoteAuth-${config.wa.remoteAuth.clientId}`
        : "RemoteAuth";

      await forceRemoteSessionReset({
        deleteRemoteSession: (session: string) => store.delete({ session }),
        clearAckWatchers: () => {}, // No ack watchers to clear in this context
        sessionName,
        dataPath: config.wa.remoteAuth.dataPath || "./data/remote-session",
        logger: this.logger,
      });

      this.logger.info("Session cleared successfully");
    } catch (err) {
      this.logger.error({ err }, "Failed to clear session");
      throw err;
    }
  }
}
