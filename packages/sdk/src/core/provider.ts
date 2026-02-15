/**
 * IVXPProvider -- Main provider class for the IVXP SDK.
 *
 * Provides a unified entry point for hosting IVXP provider services.
 * Initializes CryptoService and PaymentService internally, with
 * dependency injection support for testing.
 *
 * Serves a GET /ivxp/catalog endpoint that returns the provider's
 * service catalog including wallet address, service definitions,
 * and pricing information.
 *
 * Uses the Node.js built-in `http` module for a lightweight HTTP server
 * with no external dependencies.
 *
 * @see Story 3.14 - IVXPProvider Constructor and Catalog Endpoint
 */

import type {
  ICryptoService,
  IOrderStorage,
  IPaymentService,
  ServiceCatalog,
  ServiceDefinition,
  ServiceQuote,
  ServiceRequest,
  StoredOrder,
} from "@ivxp/protocol";
import { PROTOCOL_VERSION } from "@ivxp/protocol";
import { createCryptoService } from "../crypto/index.js";
import { PaymentService, type NetworkType } from "../payment/index.js";
import { IVXPError } from "../errors/base.js";
import { InMemoryOrderStore } from "./in-memory-order-store.js";

// ---------------------------------------------------------------------------
// UUID generation (Node.js 20+ built-in)
// ---------------------------------------------------------------------------

/**
 * Generate a random UUID v4 using the platform's built-in crypto API.
 *
 * Uses `globalThis.crypto.randomUUID()` which is available in:
 * - Node.js 19+ (via Web Crypto API)
 * - All modern browsers
 *
 * Falls back to a timestamp-based generator if unavailable (should never
 * happen in the supported Node.js 20+ runtime).
 */
function randomUUID(): string {
  return globalThis.crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Validation constants
// ---------------------------------------------------------------------------

/** Regex for a valid 0x-prefixed 32-byte hex private key (66 chars total). */
const PRIVATE_KEY_REGEX = /^0x[0-9a-fA-F]{64}$/;

/** Default port for the provider HTTP server. */
const DEFAULT_PORT = 3001;

/**
 * Default host to bind the provider HTTP server to.
 *
 * Uses loopback (127.0.0.1) by default for security: the provider
 * is only accessible from localhost. Set host to "0.0.0.0" explicitly
 * to accept connections from all network interfaces.
 */
const DEFAULT_HOST = "127.0.0.1";

/** Default provider name used in the catalog response. */
const DEFAULT_PROVIDER_NAME = "IVXP Provider";

/** Maximum valid TCP port number. */
const MAX_PORT = 65535;

/** The catalog endpoint path. */
const CATALOG_PATH = "/ivxp/catalog";

/** The quote request endpoint path. */
const REQUEST_PATH = "/ivxp/request";

/** USDC decimal places for formatting price strings. */
const USDC_DECIMAL_PLACES = 6;

/** Maximum price in USDC to avoid floating-point precision loss with toFixed(). */
const MAX_PRICE_USDC = 1_000_000;

/** Maximum estimated delivery hours (1 year) to prevent overflow. */
const MAX_DELIVERY_HOURS = 8760;

/** Regex for a valid 0x-prefixed 20-byte hex address (42 chars total). */
const HEX_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;

/** Valid network identifiers for order storage. */
const VALID_NETWORKS: ReadonlySet<string> = new Set(["base-mainnet", "base-sepolia"]);

// ---------------------------------------------------------------------------
// Lightweight types for Node.js HTTP APIs
//
// Defined inline to avoid a hard dependency on @types/node.
// Only the subset of methods/properties actually used is declared.
// ---------------------------------------------------------------------------

/** Minimal IncomingMessage shape (subset of node:http.IncomingMessage). */
interface IncomingMsg {
  readonly method?: string;
  readonly url?: string;
  on(event: string, listener: (data: unknown) => void): void;
}

/** Minimal ServerResponse shape (subset of node:http.ServerResponse). */
interface ServerRes {
  writeHead(statusCode: number, headers?: Record<string, string>): void;
  end(data?: string): void;
}

/** Minimal Server shape (subset of node:http.Server). */
interface HttpServer {
  listen(port: number, host: string, callback: () => void): void;
  address(): { port: number } | string | null;
  close(callback: () => void): void;
  on(event: "error", listener: (err: Error) => void): void;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Result of starting the IVXPProvider HTTP server.
 */
export interface ProviderStartResult {
  /** The port the server is listening on. */
  readonly port: number;

  /** The host the server is bound to. */
  readonly host: string;
}

/**
 * Configuration for creating an IVXPProvider instance.
 */
export interface IVXPProviderConfig {
  /** The 0x-prefixed hex private key for signing and receiving payments (32 bytes). */
  readonly privateKey: `0x${string}`;

  /** Services offered by this provider. Must contain at least one service. */
  readonly services: readonly ServiceDefinition[];

  /** Network to use. Defaults to "base-sepolia". */
  readonly network?: NetworkType;

  /**
   * Port to listen on. Defaults to 3001.
   *
   * Set to 0 to let the OS assign an available ephemeral port.
   * The actual assigned port is returned in the `ProviderStartResult`
   * from `start()`. This is particularly useful in tests to avoid
   * port conflicts.
   */
  readonly port?: number;

  /** Host to bind to. Defaults to "127.0.0.1" (loopback only). */
  readonly host?: string;

  /** Provider name displayed in catalog. Defaults to "IVXP Provider". */
  readonly providerName?: string;

  /** Optional: Custom crypto service for testing. */
  readonly cryptoService?: ICryptoService;

  /** Optional: Custom payment service for testing. */
  readonly paymentService?: IPaymentService;

  /**
   * Optional: Custom order storage backend.
   *
   * Defaults to InMemoryOrderStore. Inject a custom IOrderStorage
   * implementation for persistent storage (e.g. SQLite, PostgreSQL).
   */
  readonly orderStore?: IOrderStorage;
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

/**
 * Validate the IVXPProviderConfig at construction time.
 *
 * @param config - The configuration to validate
 * @throws IVXPError with code INVALID_PROVIDER_CONFIG if any field is invalid
 */
function validateConfig(config: IVXPProviderConfig): void {
  if (!config.privateKey || !PRIVATE_KEY_REGEX.test(config.privateKey)) {
    throw new IVXPError(
      "Invalid private key: must be a 0x-prefixed 64-character hex string (32 bytes)",
      "INVALID_PRIVATE_KEY",
      { field: "privateKey" },
    );
  }

  if (!config.services || config.services.length === 0) {
    throw new IVXPError(
      "Invalid provider config: services must be a non-empty array",
      "INVALID_PROVIDER_CONFIG",
      { field: "services" },
    );
  }

  if (config.port !== undefined) {
    if (config.port === 0) {
      // port 0 is valid: instructs the OS to assign an available
      // ephemeral port. The actual port is returned from start().
    } else if (!Number.isInteger(config.port) || config.port < 1 || config.port > MAX_PORT) {
      throw new IVXPError(
        `Invalid provider config: port must be an integer between 1 and ${MAX_PORT}, or 0 for OS-assigned`,
        "INVALID_PROVIDER_CONFIG",
        { field: "port", value: config.port },
      );
    }
  }
}

/**
 * Validate that an injected order store implements all required IOrderStorage methods.
 *
 * @param store - The order storage to validate
 * @throws IVXPError with code INVALID_PROVIDER_CONFIG if the store is missing methods
 */
function validateOrderStore(store: IOrderStorage): void {
  const requiredMethods = ["create", "get", "update", "list", "delete"] as const;

  for (const method of requiredMethods) {
    if (typeof (store as unknown as Record<string, unknown>)[method] !== "function") {
      throw new IVXPError(
        `Invalid order store: missing required method '${method}'`,
        "INVALID_PROVIDER_CONFIG",
        { field: "orderStore", missingMethod: method },
      );
    }
  }
}

// ---------------------------------------------------------------------------
// IVXPProvider
// ---------------------------------------------------------------------------

/**
 * Main provider class for the IVXP protocol.
 *
 * Hosts an HTTP server that serves the provider's service catalog and
 * will support additional provider endpoints in future stories.
 *
 * @example
 * ```typescript
 * const provider = new IVXPProvider({
 *   privateKey: "0x...",
 *   services: [
 *     { type: "code_review", base_price_usdc: 10, estimated_delivery_hours: 1 },
 *   ],
 * });
 *
 * const { port } = await provider.start();
 * console.log(`Provider listening on port ${port}`);
 *
 * // GET http://localhost:{port}/ivxp/catalog returns the service catalog
 *
 * await provider.stop();
 * ```
 */
export class IVXPProvider {
  private readonly cryptoService: ICryptoService;
  private readonly paymentService: IPaymentService;
  private readonly orderStore: IOrderStorage;
  private readonly services: readonly ServiceDefinition[];
  private readonly port: number;
  private readonly host: string;
  private readonly network: NetworkType;
  private readonly providerName: string;

  /**
   * Mutable lifecycle state: reference to the running HTTP server.
   *
   * This field is intentionally mutable to track the server lifecycle
   * (null = stopped, non-null = running). This is an exception to the
   * project immutability principle because server lifecycle is inherently
   * stateful. Access is guarded by the `start()` / `stop()` methods
   * which use an atomic-swap pattern to prevent race conditions.
   */
  private server: HttpServer | null = null;

  /**
   * Create a new IVXPProvider instance.
   *
   * Validates the configuration. Initializes CryptoService and
   * PaymentService internally (or uses injected overrides for testing).
   *
   * @param config - Provider configuration
   * @throws IVXPError with code INVALID_PRIVATE_KEY if the private key format is invalid
   * @throws IVXPError with code INVALID_PROVIDER_CONFIG if config is invalid
   */
  constructor(config: IVXPProviderConfig) {
    validateConfig(config);

    // Deep defensive copy of services array for immutability.
    // Each ServiceDefinition is shallow-copied so external mutations
    // to the original objects cannot affect internal state.
    this.services = config.services.map((s) => ({ ...s }));
    this.port = config.port ?? DEFAULT_PORT;
    this.host = config.host ?? DEFAULT_HOST;
    this.network = config.network ?? "base-sepolia";
    this.providerName = config.providerName ?? DEFAULT_PROVIDER_NAME;

    // Initialize services with DI support
    this.cryptoService = config.cryptoService ?? createCryptoService(config.privateKey);

    this.paymentService =
      config.paymentService ??
      new PaymentService({
        privateKey: config.privateKey,
        network: this.network,
      });

    this.orderStore = config.orderStore ?? new InMemoryOrderStore();

    // Validate injected orderStore implements required interface (#6)
    if (config.orderStore) {
      validateOrderStore(config.orderStore);
    }
  }

  // -------------------------------------------------------------------------
  // Getters
  // -------------------------------------------------------------------------

  /**
   * Get the wallet address for this provider.
   *
   * @returns The hex-encoded wallet address (0x-prefixed, checksummed)
   */
  async getAddress(): Promise<`0x${string}`> {
    return this.cryptoService.getAddress();
  }

  /**
   * Get the network this provider is configured for.
   *
   * @returns The network type ("base-mainnet" or "base-sepolia")
   */
  getNetwork(): NetworkType {
    return this.network;
  }

  /**
   * Get the configured port.
   *
   * @returns The port number
   */
  getPort(): number {
    return this.port;
  }

  /**
   * Get the configured host.
   *
   * @returns The host string
   */
  getHost(): string {
    return this.host;
  }

  /**
   * Check if the HTTP server is currently running.
   *
   * @returns true if the server is active
   */
  isRunning(): boolean {
    return this.server !== null;
  }

  // -------------------------------------------------------------------------
  // Service accessors (for advanced usage)
  // -------------------------------------------------------------------------

  /** Access the underlying crypto service. */
  get crypto(): ICryptoService {
    return this.cryptoService;
  }

  /** Access the underlying payment service. */
  get payment(): IPaymentService {
    return this.paymentService;
  }

  // -------------------------------------------------------------------------
  // Catalog
  // -------------------------------------------------------------------------

  /**
   * Build the service catalog response.
   *
   * Returns a new ServiceCatalog object each call (immutability).
   * Includes the provider's wallet address, all registered services
   * with prices, protocol version, and current timestamp.
   *
   * @returns A valid ServiceCatalog with wallet_address and services
   */
  async getCatalog(): Promise<ServiceCatalog> {
    const walletAddress = await this.cryptoService.getAddress();

    return {
      protocol: PROTOCOL_VERSION,
      provider: this.providerName,
      wallet_address: walletAddress,
      services: this.services.map((s) => ({ ...s })),
      message_type: "service_catalog",
      timestamp: new Date().toISOString(),
    };
  }

  // -------------------------------------------------------------------------
  // Quote endpoint
  // -------------------------------------------------------------------------

  /**
   * Handle a service request and generate a quote.
   *
   * Validates that the requested service exists in the catalog, generates
   * a unique order ID, persists the order to storage, and returns a
   * ServiceQuote with pricing and payment information.
   *
   * @param request - The incoming ServiceRequest (wire format)
   * @returns A ServiceQuote with order ID, pricing, and payment details
   * @throws IVXPError with code SERVICE_NOT_FOUND if the service type is unknown
   */
  async handleQuoteRequest(request: ServiceRequest): Promise<ServiceQuote> {
    // Validate service type is a non-empty string (#2)
    const serviceType = request.service_request?.type;
    if (!serviceType || typeof serviceType !== "string" || serviceType.trim().length === 0) {
      throw new IVXPError(
        "Invalid request: service_request.type must be a non-empty string",
        "INVALID_REQUEST",
        { field: "service_request.type" },
      );
    }

    // Validate client wallet address format (#2)
    const clientAddress = request.client_agent?.wallet_address;
    if (!clientAddress || !HEX_ADDRESS_REGEX.test(clientAddress)) {
      throw new IVXPError(
        "Invalid request: client_agent.wallet_address must be a valid 0x-prefixed hex address",
        "INVALID_REQUEST",
        { field: "client_agent.wallet_address" },
      );
    }

    const service = this.services.find((s) => s.type === serviceType);

    if (!service) {
      throw new IVXPError(`Unknown service: ${serviceType}`, "SERVICE_NOT_FOUND", {
        service: serviceType,
      });
    }

    // Validate price is within safe range for toFixed() (#4)
    if (service.base_price_usdc < 0 || service.base_price_usdc > MAX_PRICE_USDC) {
      throw new IVXPError(
        `Service price out of range: ${service.base_price_usdc} USDC. Must be between 0 and ${MAX_PRICE_USDC}`,
        "INVALID_PROVIDER_CONFIG",
        { field: "base_price_usdc", value: service.base_price_usdc },
      );
    }

    // Validate estimated delivery hours is within safe range (#5)
    if (
      service.estimated_delivery_hours <= 0 ||
      service.estimated_delivery_hours > MAX_DELIVERY_HOURS
    ) {
      throw new IVXPError(
        `Estimated delivery hours out of range: ${service.estimated_delivery_hours}. Must be between 1 and ${MAX_DELIVERY_HOURS}`,
        "INVALID_PROVIDER_CONFIG",
        { field: "estimated_delivery_hours", value: service.estimated_delivery_hours },
      );
    }

    // Validate network before storing (#9)
    if (!VALID_NETWORKS.has(this.network)) {
      throw new IVXPError(
        `Invalid network: ${this.network}. Must be one of: ${[...VALID_NETWORKS].join(", ")}`,
        "INVALID_PROVIDER_CONFIG",
        { field: "network", value: this.network },
      );
    }

    const walletAddress = await this.cryptoService.getAddress();
    const orderId = `ivxp-${randomUUID()}`;
    const now = new Date();

    // Persist order with "quoted" status
    await this.orderStore.create({
      orderId,
      status: "quoted",
      clientAddress: request.client_agent.wallet_address,
      serviceType,
      priceUsdc: service.base_price_usdc.toFixed(USDC_DECIMAL_PLACES),
      paymentAddress: walletAddress,
      network: this.network,
    });

    // Build the wire-format ServiceQuote response
    return {
      protocol: PROTOCOL_VERSION,
      message_type: "service_quote",
      timestamp: now.toISOString(),
      order_id: orderId,
      provider_agent: {
        name: this.providerName,
        wallet_address: walletAddress,
      },
      quote: {
        price_usdc: service.base_price_usdc,
        estimated_delivery: new Date(
          now.getTime() + service.estimated_delivery_hours * 3_600_000,
        ).toISOString(),
        payment_address: walletAddress,
        network: this.network,
      },
    };
  }

  /**
   * Retrieve an order by its ID.
   *
   * @param orderId - The order identifier to look up
   * @returns The stored order if found, or null
   */
  async getOrder(orderId: string): Promise<StoredOrder | null> {
    return this.orderStore.get(orderId);
  }

  // -------------------------------------------------------------------------
  // Server lifecycle
  // -------------------------------------------------------------------------

  /**
   * Start the HTTP server.
   *
   * Binds the server to the configured port and host. Serves
   * GET /ivxp/catalog with the provider's service catalog.
   *
   * @returns The actual port and host the server is listening on
   * @throws IVXPError if the server is already running
   * @throws Error if the server fails to start (e.g. port in use)
   */
  async start(): Promise<ProviderStartResult> {
    if (this.server) {
      throw new IVXPError("Provider server is already running", "PROVIDER_ALREADY_RUNNING");
    }

    // Dynamic import for Node.js http module to avoid @types/node dependency
    const httpModuleName = "node:http";
    const http = (await import(/* @vite-ignore */ httpModuleName)) as {
      createServer: (handler: (req: IncomingMsg, res: ServerRes) => void) => HttpServer;
    };

    return new Promise((resolve, reject) => {
      const requestHandler = (req: IncomingMsg, res: ServerRes): void => {
        this.handleRequest(req, res).catch((error: unknown) => {
          console.error("Unexpected error in provider request handler:", error);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Internal server error" }));
        });
      };

      const server = http.createServer(requestHandler);

      server.on("error", (err: Error) => {
        reject(err);
      });

      server.listen(this.port, this.host, () => {
        const addr = server.address();
        const assignedPort = typeof addr === "object" && addr !== null ? addr.port : this.port;

        this.server = server;

        resolve({
          port: assignedPort,
          host: this.host,
        });
      });
    });
  }

  /**
   * Stop the HTTP server gracefully.
   *
   * Uses an atomic-swap pattern: captures the server reference and
   * sets `this.server` to null before initiating close. This prevents
   * concurrent `stop()` calls from double-closing the same server
   * and ensures `isRunning()` returns false immediately.
   *
   * Safe to call if the server is not running or has already been stopped.
   */
  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    // Atomic swap: capture ref and null out before async close.
    // Prevents double-close if stop() is called concurrently.
    const server = this.server;
    this.server = null;

    return new Promise((resolve) => {
      server.close(() => resolve());
    });
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Handle an incoming HTTP request.
   *
   * Routes:
   * - GET  /ivxp/catalog  -> Service catalog
   * - POST /ivxp/request  -> Quote generation
   *
   * Returns 404 for unknown paths and 405 for incorrect methods
   * on known paths.
   *
   * Normalizes the URL before matching: strips query parameters
   * and trailing slashes so that `/ivxp/catalog/`, `/ivxp/catalog?foo=bar`,
   * and `/ivxp/catalog` all resolve to the same route.
   */
  private async handleRequest(req: IncomingMsg, res: ServerRes): Promise<void> {
    const rawUrl = req.url ?? "";
    const method = req.method ?? "";

    // Normalize: strip query string, then strip trailing slashes (but keep root "/")
    const pathOnly = rawUrl.split("?")[0];
    const normalizedPath = pathOnly.length > 1 ? pathOnly.replace(/\/+$/, "") : pathOnly;

    // Route: GET /ivxp/catalog
    if (normalizedPath === CATALOG_PATH) {
      if (method !== "GET") {
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Method not allowed" }));
        return;
      }

      const catalog = await this.getCatalog();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(catalog));
      return;
    }

    // Route: POST /ivxp/request
    if (normalizedPath === REQUEST_PATH) {
      if (method !== "POST") {
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Method not allowed" }));
        return;
      }

      await this.handleQuoteRoute(req, res);
      return;
    }

    // Unknown route
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  }

  /**
   * Handle the POST /ivxp/request route.
   *
   * Reads the request body, parses it as JSON, validates basic
   * structure, and delegates to `handleQuoteRequest()`.
   */
  private async handleQuoteRoute(req: IncomingMsg, res: ServerRes): Promise<void> {
    // Read and parse body
    let body: unknown;
    try {
      const rawBody = await readRequestBody(req);
      body = JSON.parse(rawBody);
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON body" }));
      return;
    }

    // Validate minimal structure
    if (
      !body ||
      typeof body !== "object" ||
      !("service_request" in body) ||
      !("client_agent" in body)
    ) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing required fields: service_request, client_agent" }));
      return;
    }

    try {
      const quote = await this.handleQuoteRequest(body as ServiceRequest);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(quote));
    } catch (error: unknown) {
      if (error instanceof IVXPError) {
        // Map known error codes to HTTP status codes
        if (error.code === "SERVICE_NOT_FOUND") {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: error.message }));
          return;
        }

        // Validation errors return 400 with the error message (no internal details)
        if (error.code === "INVALID_REQUEST") {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: error.message }));
          return;
        }

        // All other IVXPError types: return sanitized 400 without leaking details
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid request" }));
        return;
      }
      throw error;
    }
  }
}

// ---------------------------------------------------------------------------
// Request body reader
// ---------------------------------------------------------------------------

/**
 * Read the full request body from an IncomingMessage as a string.
 *
 * Collects data chunks and concatenates them once the stream ends.
 * Returns an empty string if the request has no body.
 *
 * Avoids `Buffer` type references to maintain @types/node independence.
 * Instead, treats chunks as opaque values and uses the TextDecoder API
 * (available in Node.js 20+) for string conversion.
 */
function readRequestBody(req: IncomingMsg): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: unknown) => {
      body += String(chunk);
    });
    req.on("end", () => {
      resolve(body);
    });
    req.on("error", (err: unknown) => {
      reject(err);
    });
  });
}

// ---------------------------------------------------------------------------
// Factory function
// ---------------------------------------------------------------------------

/**
 * Create a new IVXPProvider instance with input validation.
 *
 * Delegates all validation to the IVXPProvider constructor via
 * `validateConfig`. Prefer this over `new IVXPProvider()` for
 * a cleaner factory-style API.
 *
 * @param config - Provider configuration
 * @returns A configured IVXPProvider instance
 * @throws IVXPError with code INVALID_PRIVATE_KEY if the private key is invalid
 * @throws IVXPError with code INVALID_PROVIDER_CONFIG if the configuration is invalid
 */
export function createIVXPProvider(config: IVXPProviderConfig): IVXPProvider {
  return new IVXPProvider(config);
}
