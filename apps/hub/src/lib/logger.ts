/**
 * Structured logging utility for API routes
 */

interface LogContext {
  [key: string]: unknown;
}

export function logError(message: string, error: unknown, context?: LogContext): void {
  const timestamp = new Date().toISOString();
  const errorDetails =
    error instanceof Error ? { message: error.message, stack: error.stack } : { error };

  console.error(
    JSON.stringify({
      timestamp,
      level: "error",
      message,
      ...errorDetails,
      ...context,
    }),
  );
}

export function logInfo(message: string, context?: LogContext): void {
  const timestamp = new Date().toISOString();

  console.log(
    JSON.stringify({
      timestamp,
      level: "info",
      message,
      ...context,
    }),
  );
}

export function logWarn(message: string, context?: LogContext): void {
  const timestamp = new Date().toISOString();

  console.warn(
    JSON.stringify({
      timestamp,
      level: "warn",
      message,
      ...context,
    }),
  );
}
