/**
 * Express server for the IVXP Demo Provider.
 *
 * Wraps the SDK's IVXPProvider with Express middleware for:
 * - CORS support for Hub frontend access (with credentials and preflight caching)
 * - Rate limiting (configurable, default 100 req/min per IP)
 * - JSON body parsing with size limit (64 KB max, matching SDK's MAX_REQUEST_BODY_SIZE)
 * - Structured request/response logging via pino
 * - Health check endpoint
 * - Zod schema validation on all POST request bodies
 *
 * The IVXPProvider's built-in HTTP server is NOT used here.
 * Instead, Express handles HTTP and delegates IVXP protocol
 * logic to the provider instance directly.
 */

import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { IVXPProvider, IVXPError } from "@ivxp/sdk";
import type { ServiceRequest, DeliveryRequest } from "@ivxp/protocol";
import type { ProviderConfig } from "./config.js";
import { DEMO_SERVICES } from "./catalog.js";
import { createServiceHandlers } from "./handlers.js";
import { createLogger, type Logger } from "./logger.js";
import { ServiceRequestBodySchema, DeliveryRequestBodySchema } from "./schemas.js";

/**
 * Maximum JSON body size accepted by Express.
 *
 * Set to 64 KB to match the SDK's internal MAX_REQUEST_BODY_SIZE constant.
 * Requests exceeding this limit receive a 413 Payload Too Large response
 * before any route handler is invoked.
 */
const MAX_BODY_SIZE = "64kb";

/**
 * CORS preflight cache duration in seconds.
 *
 * Browsers cache the preflight OPTIONS response for this duration,
 * reducing the number of preflight requests for repeated API calls.
 */
const CORS_MAX_AGE_SECONDS = 600;

export interface ServerDependencies {
  readonly config: ProviderConfig;
  readonly logger?: Logger;
  /** Optional: inject a pre-configured provider (for testing). */
  readonly provider?: IVXPProvider;
}

export interface ServerInstance {
  readonly app: express.Express;
  readonly provider: IVXPProvider;
  readonly logger: Logger;
}

/**
 * Create the Express application with all middleware and routes.
 *
 * Does NOT start listening -- call `app.listen()` separately.
 */
export function createServer(deps: ServerDependencies): ServerInstance {
  const { config } = deps;
  const logger = deps.logger ?? createLogger(config.logLevel);

  const provider =
    deps.provider ??
    new IVXPProvider({
      privateKey: config.privateKey,
      services: [...DEMO_SERVICES],
      network: config.network,
      port: 0, // Not used; Express handles HTTP
      host: "0.0.0.0",
      providerName: config.providerName,
      serviceHandlers: createServiceHandlers(),
      allowPrivateDeliveryUrls: true,
    });

  const app = express();

  // ---------------------------------------------------------------------------
  // Middleware
  // ---------------------------------------------------------------------------

  // CORS -- supports credentials for authenticated Hub requests and caches
  // preflight responses to reduce OPTIONS round-trips.
  app.use(
    cors({
      origin: [...config.corsAllowedOrigins],
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
      maxAge: CORS_MAX_AGE_SECONDS,
    }),
  );

  // JSON body parsing with 64 KB size limit (matches SDK's MAX_REQUEST_BODY_SIZE).
  // Requests exceeding this limit are rejected with 413 before reaching route handlers.
  app.use(express.json({ limit: MAX_BODY_SIZE }));

  // Rate limiting -- configurable via ProviderConfig, defaults to 100 req/min per IP.
  app.use(
    rateLimit({
      windowMs: config.rateLimitWindowMs,
      max: config.rateLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "Too many requests, please try again later" },
    }),
  );

  // Request logging
  app.use((req: Request, _res: Response, next: NextFunction) => {
    logger.info({ method: req.method, url: req.url }, "incoming request");
    next();
  });

  // ---------------------------------------------------------------------------
  // Health check
  // ---------------------------------------------------------------------------

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: Date.now() });
  });

  // ---------------------------------------------------------------------------
  // IVXP Protocol Routes
  // ---------------------------------------------------------------------------

  // GET /ivxp/catalog
  app.get("/ivxp/catalog", async (_req: Request, res: Response) => {
    try {
      const catalog = await provider.getCatalog();
      res.json(catalog);
    } catch (error: unknown) {
      logger.error({ error }, "catalog error");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /ivxp/request (quote generation)
  app.post("/ivxp/request", async (req: Request, res: Response) => {
    try {
      // Validate request body against schema
      const parseResult = ServiceRequestBodySchema.safeParse(req.body);
      if (!parseResult.success) {
        const issues = parseResult.error.issues;
        const firstIssue = issues[0];
        const path = firstIssue?.path.join(".") ?? "unknown";
        const message = firstIssue?.message ?? "Validation failed";
        res.status(400).json({
          error: `Invalid request: ${path} - ${message}`,
        });
        return;
      }

      // parseResult.data is typed and validated -- safe to pass as ServiceRequest
      const quote = await provider.handleQuoteRequest(
        parseResult.data as unknown as ServiceRequest,
      );
      res.json(quote);
    } catch (error: unknown) {
      handleIVXPError(error, res, logger);
    }
  });

  // POST /ivxp/deliver (delivery after payment)
  app.post("/ivxp/deliver", async (req: Request, res: Response) => {
    try {
      // Validate request body against schema
      const parseResult = DeliveryRequestBodySchema.safeParse(req.body);
      if (!parseResult.success) {
        const issues = parseResult.error.issues;
        const firstIssue = issues[0];
        const path = firstIssue?.path.join(".") ?? "unknown";
        const message = firstIssue?.message ?? "Validation failed";
        res.status(400).json({
          error: `Invalid delivery request: ${path} - ${message}`,
        });
        return;
      }

      // parseResult.data is typed and validated -- safe to pass as DeliveryRequest
      const accepted = await provider.handleDeliveryRequest(
        parseResult.data as unknown as DeliveryRequest,
      );
      res.json(accepted);
    } catch (error: unknown) {
      handleIVXPError(error, res, logger);
    }
  });

  // GET /ivxp/status/:orderId
  app.get("/ivxp/status/:orderId", async (req: Request, res: Response) => {
    try {
      const rawParam = req.params["orderId"];
      const orderId = Array.isArray(rawParam) ? rawParam[0] ?? "" : rawParam ?? "";
      const status = await provider.handleStatusRequest(orderId);
      res.json(status);
    } catch (error: unknown) {
      handleIVXPError(error, res, logger);
    }
  });

  // GET /ivxp/download/:orderId
  app.get("/ivxp/download/:orderId", async (req: Request, res: Response) => {
    try {
      const rawParam = req.params["orderId"];
      const orderId = Array.isArray(rawParam) ? rawParam[0] ?? "" : rawParam ?? "";
      const download = await provider.handleDownloadRequest(orderId);
      res.json(download);
    } catch (error: unknown) {
      handleIVXPError(error, res, logger);
    }
  });

  return { app, provider, logger };
}

// ---------------------------------------------------------------------------
// Error handling helper
// ---------------------------------------------------------------------------

/** Map IVXPError codes to HTTP status codes. */
const ERROR_STATUS_MAP: Record<string, number> = {
  SERVICE_NOT_FOUND: 404,
  ORDER_NOT_FOUND: 404,
  DELIVERABLE_NOT_READY: 404,
  INVALID_REQUEST: 400,
  INVALID_ORDER_STATUS: 400,
  PAYMENT_VERIFICATION_FAILED: 400,
  SIGNATURE_VERIFICATION_FAILED: 400,
  INVALID_SIGNED_MESSAGE: 400,
  NETWORK_MISMATCH: 400,
};

function handleIVXPError(error: unknown, res: Response, logger: Logger): void {
  if (error instanceof IVXPError) {
    const status = ERROR_STATUS_MAP[error.code] ?? 400;
    logger.warn({ code: error.code, message: error.message }, "IVXP error");
    res.status(status).json({ error: error.message });
    return;
  }

  logger.error({ error }, "unexpected error");
  res.status(500).json({ error: "Internal server error" });
}
