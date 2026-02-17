/**
 * IVXP Demo Provider - Application entry point.
 *
 * Loads configuration, creates the Express server, and starts listening.
 * Handles graceful shutdown on SIGINT/SIGTERM with a configurable timeout.
 */

import { loadConfig } from "./config.js";
import { createServer } from "./server.js";
import { createLogger } from "./logger.js";

/** Maximum time (ms) to wait for in-flight requests during shutdown. */
const SHUTDOWN_TIMEOUT_MS = 10_000;

async function main(): Promise<void> {
  const config = loadConfig();
  const { app, provider, logger } = createServer({ config });

  const address = await provider.getAddress();
  logger.info({ network: config.network, address }, "provider wallet");

  const server = app.listen(config.port, () => {
    logger.info({ port: config.port }, "IVXP Demo Provider listening");
    logger.info(
      { endpoints: ["/health", "/ivxp/catalog", "/ivxp/request", "/ivxp/deliver", "/ivxp/status/:id", "/ivxp/download/:id"] },
      "available endpoints",
    );
  });

  // Track whether shutdown is already in progress to prevent double-shutdown
  let shuttingDown = false;

  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info({ signal }, "received shutdown signal, draining connections...");

    // Force-exit if graceful shutdown takes too long
    const forceTimer = setTimeout(() => {
      logger.error("graceful shutdown timed out, forcing exit");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

    // Unref so the timer doesn't keep the process alive if close() finishes first
    forceTimer.unref();

    server.close((err) => {
      clearTimeout(forceTimer);
      if (err) {
        logger.error({ error: err }, "error during server close");
        process.exit(1);
      }
      logger.info("server closed gracefully");
      process.exit(0);
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((error: unknown) => {
  // Use a bootstrap logger since the server logger may not exist yet
  const bootstrapLogger = createLogger("error");
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  bootstrapLogger.fatal({ error: message, stack }, "fatal error starting demo provider");
  process.exit(1);
});
