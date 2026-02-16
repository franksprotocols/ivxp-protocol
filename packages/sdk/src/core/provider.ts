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
  IPaymentService,
  ServiceCatalog,
  ServiceDefinition,
} from "@ivxp/protocol";
import { PROTOCOL_VERSION } from "@ivxp/protocol";
import { createCryptoService } from "../crypto/index.js";
import { PaymentService, type NetworkType } from "../payment/index.js";
import { IVXPError } from "../errors/base.js";

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
   * Routes GET /ivxp/catalog to the catalog endpoint.
   * Returns 404 for unknown paths and 405 for non-GET methods
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

    // Unknown route
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  }
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
