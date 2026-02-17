/**
 * Configuration loader for the IVXP Demo Provider.
 *
 * Reads environment variables and provides validated, typed configuration.
 * Fails fast with clear error messages if required variables are missing.
 */

/** Valid log levels for pino. */
const VALID_LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;
type LogLevel = (typeof VALID_LOG_LEVELS)[number];

/** Regex for a valid 0x-prefixed 32-byte hex private key (66 chars total). */
const PRIVATE_KEY_REGEX = /^0x[0-9a-fA-F]{64}$/;

/** Maximum valid TCP port number. */
const MAX_PORT = 65535;

/** Default rate limit: 100 requests per window. */
const DEFAULT_RATE_LIMIT_MAX = 100;

/** Default rate limit window: 60 seconds. */
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * Validated configuration for the demo provider.
 */
export interface ProviderConfig {
  readonly port: number;
  readonly privateKey: `0x${string}`;
  readonly corsAllowedOrigins: readonly string[];
  readonly logLevel: LogLevel;
  readonly network: "base-mainnet" | "base-sepolia";
  readonly providerName: string;
  readonly rateLimitWindowMs: number;
  readonly rateLimitMax: number;
}

/**
 * Load and validate configuration from environment variables.
 *
 * @returns Validated ProviderConfig
 * @throws Error if required variables are missing or invalid
 */
export function loadConfig(): ProviderConfig {
  const errors: string[] = [];

  // PORT (optional, default 3001)
  const rawPort = process.env["PORT"] ?? "3001";
  const port = parseInt(rawPort, 10);
  if (isNaN(port) || port < 1 || port > MAX_PORT) {
    errors.push(`PORT must be an integer between 1 and ${MAX_PORT}, got: ${rawPort}`);
  }

  // PROVIDER_PRIVATE_KEY (required)
  const privateKey = process.env["PROVIDER_PRIVATE_KEY"] ?? "";
  if (!PRIVATE_KEY_REGEX.test(privateKey)) {
    errors.push(
      "PROVIDER_PRIVATE_KEY must be a 0x-prefixed 64-character hex string (32 bytes)",
    );
  }

  // CORS_ALLOWED_ORIGINS (optional, comma-separated)
  const rawOrigins = process.env["CORS_ALLOWED_ORIGINS"] ?? "http://localhost:3000";
  const corsAllowedOrigins = rawOrigins
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

  // LOG_LEVEL (optional, default "info")
  const rawLogLevel = (process.env["LOG_LEVEL"] ?? "info") as LogLevel;
  if (!VALID_LOG_LEVELS.includes(rawLogLevel)) {
    errors.push(`LOG_LEVEL must be one of: ${VALID_LOG_LEVELS.join(", ")}, got: ${rawLogLevel}`);
  }

  // NETWORK (optional, default "base-sepolia")
  const rawNetwork = process.env["NETWORK"] ?? "base-sepolia";
  if (rawNetwork !== "base-mainnet" && rawNetwork !== "base-sepolia") {
    errors.push(`NETWORK must be "base-mainnet" or "base-sepolia", got: ${rawNetwork}`);
  }

  // PROVIDER_NAME (optional)
  const providerName = process.env["PROVIDER_NAME"] ?? "IVXP Demo Provider";

  // RATE_LIMIT_MAX (optional, default 100)
  const rawRateLimitMax = process.env["RATE_LIMIT_MAX"] ?? String(DEFAULT_RATE_LIMIT_MAX);
  const rateLimitMax = parseInt(rawRateLimitMax, 10);
  if (isNaN(rateLimitMax) || rateLimitMax < 1) {
    errors.push(`RATE_LIMIT_MAX must be a positive integer, got: ${rawRateLimitMax}`);
  }

  // RATE_LIMIT_WINDOW_MS (optional, default 60000)
  const rawRateLimitWindowMs = process.env["RATE_LIMIT_WINDOW_MS"] ?? String(DEFAULT_RATE_LIMIT_WINDOW_MS);
  const rateLimitWindowMs = parseInt(rawRateLimitWindowMs, 10);
  if (isNaN(rateLimitWindowMs) || rateLimitWindowMs < 1000) {
    errors.push(`RATE_LIMIT_WINDOW_MS must be an integer >= 1000, got: ${rawRateLimitWindowMs}`);
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n  - ${errors.join("\n  - ")}`);
  }

  return {
    port,
    privateKey: privateKey as `0x${string}`,
    corsAllowedOrigins,
    logLevel: rawLogLevel,
    network: rawNetwork as "base-mainnet" | "base-sepolia",
    providerName,
    rateLimitWindowMs,
    rateLimitMax,
  };
}
