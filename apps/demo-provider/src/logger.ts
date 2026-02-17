/**
 * Structured logging for the IVXP Demo Provider.
 *
 * Uses pino for high-performance structured JSON logging.
 */

import pino from "pino";

export type Logger = pino.Logger;

/**
 * Create a pino logger instance with the given log level.
 *
 * In development (NODE_ENV !== "production"), uses pino-pretty
 * for human-readable output.
 */
export function createLogger(level: string = "info"): Logger {
  const isDev = process.env["NODE_ENV"] !== "production";

  return pino({
    level,
    ...(isDev
      ? {
          transport: {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "SYS:HH:MM:ss",
              ignore: "pid,hostname",
            },
          },
        }
      : {}),
  });
}
