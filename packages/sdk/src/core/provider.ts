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
  DeliveryAccepted,
  DeliveryRequest,
  ICryptoService,
  IOrderStorage,
  IPaymentService,
  OrderStatus,
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
import { computeContentHash } from "./content-hash.js";
import {
  InMemoryDeliverableStore,
  type IDeliverableStore,
  type StoredDeliverable,
} from "./deliverable-store.js";

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

/** The delivery endpoint path. */
const DELIVER_PATH = "/ivxp/deliver";

/** The status endpoint path prefix (followed by /{order_id}). */
const STATUS_PATH_PREFIX = "/ivxp/status/";

/** The download endpoint path prefix (followed by /{order_id}). */
const DOWNLOAD_PATH_PREFIX = "/ivxp/download/";

/** Required prefix for all IVXP order identifiers. */
const ORDER_ID_PREFIX = "ivxp-";

/** USDC decimal places for formatting price strings. */
const USDC_DECIMAL_PLACES = 6;

/** Maximum price in USDC to avoid floating-point precision loss with toFixed(). */
const MAX_PRICE_USDC = 1_000_000;

/** Maximum estimated delivery hours (1 year) to prevent overflow. */
const MAX_DELIVERY_HOURS = 8760;

/** Maximum request body size in bytes (64 KB). */
const MAX_REQUEST_BODY_SIZE = 65_536;

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
 * Response from the status endpoint (GET /ivxp/status/{order_id}).
 *
 * Returns the current lifecycle status of an order along with
 * basic metadata. If the order has a deliverable, the content_hash
 * is included for client verification before downloading.
 */
export interface OrderStatusResponse {
  /** Order identifier. */
  readonly order_id: string;

  /** Current order lifecycle status. */
  readonly status: OrderStatus;

  /** Service type requested. */
  readonly service: string;

  /** Order creation timestamp (ISO 8601). */
  readonly created_at: string;

  /** SHA-256 content hash (present only when deliverable is available). */
  readonly content_hash?: string;
}

/**
 * Response from the download endpoint (GET /ivxp/download/{order_id}).
 *
 * Returns the deliverable content with its MIME type and SHA-256
 * content hash for integrity verification by the client.
 */
export interface DownloadResponse {
  /** Order identifier. */
  readonly order_id: string;

  /** Deliverable content (string or binary). */
  readonly content: string | Uint8Array;

  /** MIME content type (e.g. "text/plain", "application/json"). */
  readonly content_type: string;

  /** SHA-256 hex-encoded hash of the content. */
  readonly content_hash: string;
}

/**
 * Service handler function type.
 *
 * Called asynchronously after a delivery request is accepted and the order
 * transitions to "paid" status. The handler processes the order and produces
 * the deliverable content.
 *
 * @param order - The stored order in "paid" status
 * @param params - Optional service-specific parameters
 * @returns The deliverable content and content type
 */
export type ServiceHandler = (
  order: StoredOrder,
  params?: Record<string, unknown>,
) => Promise<{ content: string | Uint8Array; content_type: string }>;

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

  /**
   * Optional: Service handlers mapped by service type name.
   *
   * Each handler is invoked asynchronously after a delivery request is accepted.
   * If no handler is registered for a service type, delivery acceptance still
   * succeeds but no processing is triggered.
   */
  readonly serviceHandlers?: ReadonlyMap<string, ServiceHandler>;

  /**
   * Optional: Custom deliverable storage backend.
   *
   * Defaults to InMemoryDeliverableStore. Inject a custom IDeliverableStore
   * implementation for persistent storage.
   */
  readonly deliverableStore?: IDeliverableStore;

  /**
   * Optional: Allow push delivery to private/localhost URLs.
   *
   * **WARNING**: Only use in development or testing. In production, private
   * IPs and localhost are blocked to prevent SSRF attacks.
   *
   * @default false
   */
  readonly allowPrivateDeliveryUrls?: boolean;
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
  private readonly deliverableStore: IDeliverableStore;
  private readonly allowPrivateDeliveryUrls: boolean;
  private readonly services: readonly ServiceDefinition[];
  private readonly port: number;
  private readonly host: string;
  private readonly network: NetworkType;
  private readonly providerName: string;

  /**
   * Mutable service handler registry.
   *
   * Maps service type names to their handler functions. Handlers can be
   * provided via config or registered dynamically via registerServiceHandler().
   * This is intentionally mutable to support runtime registration.
   */
  private readonly serviceHandlers: Map<string, ServiceHandler>;

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
   * Set of tx_hashes that have already been used for delivery requests.
   *
   * Prevents replay attacks where the same payment transaction is used
   * to claim delivery of multiple orders. This is an in-memory set that
   * is cleared when the provider is restarted; persistent replay protection
   * is provided by the order store's tx_hash field (each order can only
   * transition from "quoted" to "paid" once).
   */
  private readonly usedTxHashes: Set<string> = new Set();

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
    this.deliverableStore = config.deliverableStore ?? new InMemoryDeliverableStore();
    this.allowPrivateDeliveryUrls = config.allowPrivateDeliveryUrls ?? false;

    // Initialize service handlers from config (defensive copy)
    this.serviceHandlers = config.serviceHandlers ? new Map(config.serviceHandlers) : new Map();

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

  /**
   * Retrieve a deliverable by order ID.
   *
   * @param orderId - The order identifier to look up
   * @returns The stored deliverable if found, or undefined
   */
  getDeliverable(orderId: string): StoredDeliverable | undefined {
    return this.deliverableStore.get(orderId);
  }

  // -------------------------------------------------------------------------
  // Status endpoint
  // -------------------------------------------------------------------------

  /**
   * Handle a status request for an order.
   *
   * Looks up the order by ID and returns its current lifecycle status.
   * If a deliverable exists, includes the content_hash for client
   * verification before downloading.
   *
   * @param orderId - The order identifier to look up
   * @returns An OrderStatusResponse with current status and metadata
   * @throws IVXPError with code ORDER_NOT_FOUND if the order does not exist
   */
  async handleStatusRequest(orderId: string): Promise<OrderStatusResponse> {
    if (!orderId || !orderId.startsWith(ORDER_ID_PREFIX)) {
      throw new IVXPError(`Invalid order ID format: ${orderId}`, "INVALID_REQUEST", { orderId });
    }

    const order = await this.orderStore.get(orderId);
    if (!order) {
      throw new IVXPError(`Order not found: ${orderId}`, "ORDER_NOT_FOUND", {
        orderId,
      });
    }

    const deliverable = this.deliverableStore.get(orderId);

    return {
      order_id: order.orderId,
      status: order.status,
      service: order.serviceType,
      created_at: order.createdAt,
      content_hash: deliverable?.contentHash,
    };
  }

  // -------------------------------------------------------------------------
  // Download endpoint
  // -------------------------------------------------------------------------

  /**
   * Handle a download request for a deliverable.
   *
   * Looks up the order and its deliverable. Returns the content with
   * MIME type and SHA-256 hash for integrity verification.
   *
   * Supports both "delivered" and "delivery_failed" orders: even if
   * push delivery failed, the deliverable is still downloadable via pull.
   *
   * @param orderId - The order identifier to download
   * @returns A DownloadResponse with content, content_type, and content_hash
   * @throws IVXPError with code ORDER_NOT_FOUND if the order does not exist
   * @throws IVXPError with code DELIVERABLE_NOT_READY if no deliverable is stored
   */
  async handleDownloadRequest(orderId: string): Promise<DownloadResponse> {
    if (!orderId || !orderId.startsWith(ORDER_ID_PREFIX)) {
      throw new IVXPError(`Invalid order ID format: ${orderId}`, "INVALID_REQUEST", { orderId });
    }

    const order = await this.orderStore.get(orderId);
    if (!order) {
      throw new IVXPError(`Order not found: ${orderId}`, "ORDER_NOT_FOUND", {
        orderId,
      });
    }

    const deliverable = this.deliverableStore.get(orderId);
    if (!deliverable) {
      throw new IVXPError(`Deliverable not ready for order: ${orderId}`, "DELIVERABLE_NOT_READY", {
        orderId,
      });
    }

    return {
      order_id: order.orderId,
      content: deliverable.content,
      content_type: deliverable.contentType,
      content_hash: deliverable.contentHash,
    };
  }

  // -------------------------------------------------------------------------
  // Service handler registry
  // -------------------------------------------------------------------------

  /**
   * Register a service handler for a specific service type.
   *
   * The handler will be invoked asynchronously after a delivery request
   * for the given service type is accepted. Overwrites any previously
   * registered handler for the same service type.
   *
   * @param serviceType - The service type name to handle
   * @param handler - The handler function
   */
  registerServiceHandler(serviceType: string, handler: ServiceHandler): void {
    this.serviceHandlers.set(serviceType, handler);
  }

  // -------------------------------------------------------------------------
  // Delivery endpoint
  // -------------------------------------------------------------------------

  /**
   * Handle a delivery request after payment.
   *
   * Validates the order exists and is in "quoted" status, verifies on-chain
   * payment via paymentService.verify(), verifies the EIP-191 signature
   * via cryptoService.verify(), transitions the order to "paid" status,
   * and invokes the registered service handler asynchronously.
   *
   * @param request - The incoming DeliveryRequest (wire format)
   * @returns A DeliveryAccepted response
   * @throws IVXPError with code ORDER_NOT_FOUND if the order does not exist
   * @throws IVXPError with code INVALID_ORDER_STATUS if the order is not in "quoted" status
   * @throws IVXPError with code PAYMENT_VERIFICATION_FAILED if payment verification fails
   * @throws IVXPError with code SIGNATURE_VERIFICATION_FAILED if signature verification fails
   */
  async handleDeliveryRequest(request: DeliveryRequest): Promise<DeliveryAccepted> {
    // Look up order
    const order = await this.orderStore.get(request.order_id);
    if (!order) {
      throw new IVXPError(`Order not found: ${request.order_id}`, "ORDER_NOT_FOUND", {
        orderId: request.order_id,
      });
    }

    if (order.status !== "quoted") {
      throw new IVXPError(`Order not in quoted status: ${order.status}`, "INVALID_ORDER_STATUS", {
        orderId: request.order_id,
        currentStatus: order.status,
      });
    }

    // Validate signed_message contains the order_id to bind signature to order.
    // Prevents replay attacks where a valid signature for one order is used
    // to claim delivery of a different order.
    if (!request.signed_message.includes(request.order_id)) {
      throw new IVXPError(
        "Invalid signed message: must contain the order_id",
        "INVALID_SIGNED_MESSAGE",
        { orderId: request.order_id },
      );
    }

    // Validate payment network matches the provider's configured network.
    // Prevents cross-network payment spoofing (e.g. paying on Sepolia
    // testnet for a mainnet order).
    if (request.payment_proof.network !== this.network) {
      throw new IVXPError(
        `Network mismatch: expected ${this.network}, got ${request.payment_proof.network}`,
        "NETWORK_MISMATCH",
        {
          orderId: request.order_id,
          expected: this.network,
          actual: request.payment_proof.network,
        },
      );
    }

    // Replay protection: reject duplicate tx_hash usage.
    // Prevents the same payment transaction from being used to claim
    // delivery of multiple orders (Story 8.8, AC #6).
    const txHashLower = request.payment_proof.tx_hash.toLowerCase();
    if (this.usedTxHashes.has(txHashLower)) {
      throw new IVXPError(
        "Duplicate payment: this transaction hash has already been used",
        "PAYMENT_VERIFICATION_FAILED",
        {
          orderId: request.order_id,
          txHash: request.payment_proof.tx_hash,
        },
      );
    }

    // Verify on-chain payment (AC #1)
    // Amount validation is delegated to the PaymentService, which verifies
    // the on-chain transfer amount matches order.priceUsdc. This design
    // keeps the payment verification logic in a single place and allows
    // the payment service to handle USDC decimal normalization.
    const paymentValid = await this.paymentService.verify(request.payment_proof.tx_hash, {
      from: request.payment_proof.from_address,
      to: order.paymentAddress,
      amount: order.priceUsdc,
    });

    if (!paymentValid) {
      throw new IVXPError("Payment verification failed", "PAYMENT_VERIFICATION_FAILED", {
        orderId: request.order_id,
        txHash: request.payment_proof.tx_hash,
      });
    }

    // Verify EIP-191 signature (AC #2)
    const signatureValid = await this.cryptoService.verify(
      request.signed_message,
      request.signature,
      order.clientAddress,
    );

    if (!signatureValid) {
      throw new IVXPError("Signature verification failed", "SIGNATURE_VERIFICATION_FAILED", {
        orderId: request.order_id,
      });
    }

    // Record tx_hash as used to prevent replay (Story 8.8, AC #6)
    this.usedTxHashes.add(txHashLower);

    // Transition to "paid" status and store tx_hash (AC #3)
    const paidOrder = await this.orderStore.update(request.order_id, {
      status: "paid",
      txHash: request.payment_proof.tx_hash,
      deliveryEndpoint: request.delivery_endpoint,
    });

    // Invoke service handler asynchronously (fire-and-forget) (AC #3)
    const handler = this.serviceHandlers.get(order.serviceType);
    if (handler) {
      this.processOrderAsync(paidOrder, handler);
    }

    // Return DeliveryAccepted response (AC #4)
    return {
      order_id: request.order_id,
      status: "accepted",
      message: "Payment verified. Processing started.",
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
          // eslint-disable-next-line no-console
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
   * - GET  /ivxp/catalog            -> Service catalog
   * - POST /ivxp/request            -> Quote generation
   * - POST /ivxp/deliver            -> Delivery acceptance
   * - GET  /ivxp/status/{order_id}  -> Order status
   * - GET  /ivxp/download/{order_id} -> Deliverable download
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

    // Route: POST /ivxp/deliver
    if (normalizedPath === DELIVER_PATH) {
      if (method !== "POST") {
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Method not allowed" }));
        return;
      }

      await this.handleDeliverRoute(req, res);
      return;
    }

    // Route: GET /ivxp/status/{order_id}
    if (normalizedPath.startsWith(STATUS_PATH_PREFIX)) {
      if (method !== "GET") {
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Method not allowed" }));
        return;
      }

      await this.handleStatusRoute(normalizedPath, res);
      return;
    }

    // Route: GET /ivxp/download/{order_id}
    if (normalizedPath.startsWith(DOWNLOAD_PATH_PREFIX)) {
      if (method !== "GET") {
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Method not allowed" }));
        return;
      }

      await this.handleDownloadRoute(normalizedPath, res);
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
    } catch (readError: unknown) {
      if (readError instanceof IVXPError && readError.code === "REQUEST_TOO_LARGE") {
        res.writeHead(413, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Request body too large" }));
        return;
      }
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

  /**
   * Handle the POST /ivxp/deliver route.
   *
   * Reads the request body, parses it as JSON, validates basic
   * structure, and delegates to `handleDeliveryRequest()`.
   */
  private async handleDeliverRoute(req: IncomingMsg, res: ServerRes): Promise<void> {
    // Read and parse body
    let body: unknown;
    try {
      const rawBody = await readRequestBody(req);
      body = JSON.parse(rawBody);
    } catch (readError: unknown) {
      if (readError instanceof IVXPError && readError.code === "REQUEST_TOO_LARGE") {
        res.writeHead(413, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Request body too large" }));
        return;
      }
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON body" }));
      return;
    }

    // Validate minimal structure
    if (
      !body ||
      typeof body !== "object" ||
      !("order_id" in body) ||
      !("payment_proof" in body) ||
      !("signature" in body) ||
      !("signed_message" in body)
    ) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Missing required fields: order_id, payment_proof, signature, signed_message",
        }),
      );
      return;
    }

    try {
      const accepted = await this.handleDeliveryRequest(body as DeliveryRequest);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(accepted));
    } catch (error: unknown) {
      if (error instanceof IVXPError) {
        if (error.code === "ORDER_NOT_FOUND") {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: error.message }));
          return;
        }

        // Verification and validation errors return 400 with the error message
        const clientFacingCodes = new Set([
          "PAYMENT_VERIFICATION_FAILED",
          "SIGNATURE_VERIFICATION_FAILED",
          "INVALID_ORDER_STATUS",
          "INVALID_SIGNED_MESSAGE",
          "NETWORK_MISMATCH",
        ]);

        if (clientFacingCodes.has(error.code)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: error.message }));
          return;
        }

        // All other IVXPError types: return sanitized 400 without leaking details
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid delivery request" }));
        return;
      }

      // Request too large
      if (error instanceof Error && error.message.includes("too large")) {
        res.writeHead(413, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Request body too large" }));
        return;
      }

      throw error;
    }
  }

  /**
   * Handle the GET /ivxp/status/{order_id} route.
   *
   * Extracts the order ID from the URL path, delegates to
   * `handleStatusRequest()`, and returns the status as JSON.
   */
  private async handleStatusRoute(normalizedPath: string, res: ServerRes): Promise<void> {
    const rawOrderId = normalizedPath.slice(STATUS_PATH_PREFIX.length);
    const orderId = decodeURIComponent(rawOrderId).trim();

    if (!orderId || orderId.length === 0) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing order_id in URL" }));
      return;
    }

    try {
      const status = await this.handleStatusRequest(orderId);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(status));
    } catch (error: unknown) {
      if (error instanceof IVXPError && error.code === "ORDER_NOT_FOUND") {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
        return;
      }
      if (error instanceof IVXPError && error.code === "INVALID_REQUEST") {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
        return;
      }
      throw error;
    }
  }

  /**
   * Handle the GET /ivxp/download/{order_id} route.
   *
   * Extracts the order ID from the URL path, delegates to
   * `handleDownloadRequest()`, and returns the deliverable as JSON.
   */
  private async handleDownloadRoute(normalizedPath: string, res: ServerRes): Promise<void> {
    const rawOrderId = normalizedPath.slice(DOWNLOAD_PATH_PREFIX.length);
    const orderId = decodeURIComponent(rawOrderId).trim();

    if (!orderId || orderId.length === 0) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing order_id in URL" }));
      return;
    }

    try {
      const download = await this.handleDownloadRequest(orderId);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(download));
    } catch (error: unknown) {
      if (error instanceof IVXPError) {
        if (error.code === "ORDER_NOT_FOUND" || error.code === "DELIVERABLE_NOT_READY") {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: error.message }));
          return;
        }
        if (error.code === "INVALID_REQUEST") {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: error.message }));
          return;
        }
      }
      throw error;
    }
  }

  /**
   * Process an order asynchronously via its service handler.
   *
   * Fire-and-forget: the delivery acceptance response is returned
   * immediately while processing continues in the background.
   *
   * Pipeline:
   * 1. Transition order to "processing" status
   * 2. Run the service handler
   * 3. Compute SHA-256 content hash and store the deliverable
   * 4. If delivery_endpoint exists, attempt push delivery (POST)
   * 5. Transition to "delivered" on success, "delivery_failed" on push failure
   *
   * If the handler throws, the order transitions to "delivery_failed"
   * and the error is logged. No deliverable is stored in this case.
   */
  private processOrderAsync(order: StoredOrder, handler: ServiceHandler): void {
    this.processOrder(order, handler).catch((error: unknown) => {
      // eslint-disable-next-line no-console
      console.error(
        `Order processing error for ${order.orderId}:`,
        error instanceof Error ? error.message : error,
      );
    });
  }

  /**
   * Execute the full order processing pipeline.
   *
   * @param order - The order in "paid" status
   * @param handler - The service handler to invoke
   */
  private async processOrder(order: StoredOrder, handler: ServiceHandler): Promise<void> {
    // Step 1: Transition to "processing"
    const processingOrder = await this.orderStore.update(order.orderId, {
      status: "processing",
    });

    try {
      // Step 2: Run service handler
      const result = await handler(processingOrder);

      // Step 3: Compute content hash and store deliverable
      const contentHash = await computeContentHash(result.content);
      const deliverable: StoredDeliverable = {
        orderId: order.orderId,
        content: result.content,
        contentType: result.content_type,
        contentHash,
        createdAt: new Date().toISOString(),
      };
      this.deliverableStore.set(order.orderId, deliverable);

      // Update order with content hash
      await this.orderStore.update(order.orderId, { contentHash });

      // Step 4: Attempt push delivery if delivery_endpoint exists
      if (processingOrder.deliveryEndpoint) {
        try {
          await this.pushDeliverable(processingOrder.deliveryEndpoint, deliverable);
          // Step 5a: Push succeeded -> "delivered"
          await this.orderStore.update(order.orderId, { status: "delivered" });
        } catch {
          // Step 5b: Push failed -> "delivery_failed" (deliverable still stored)
          await this.orderStore.update(order.orderId, { status: "delivery_failed" });
        }
      } else {
        // Pull mode: mark as "delivered" immediately
        await this.orderStore.update(order.orderId, { status: "delivered" });
      }
    } catch (handlerError: unknown) {
      // Handler threw: transition to "delivery_failed"
      // eslint-disable-next-line no-console
      console.error(
        `Service handler error for order ${order.orderId}:`,
        handlerError instanceof Error ? handlerError.message : handlerError,
      );

      try {
        await this.orderStore.update(order.orderId, { status: "delivery_failed" });
      } catch (updateError: unknown) {
        // eslint-disable-next-line no-console
        console.error(
          `Failed to update order ${order.orderId} to delivery_failed:`,
          updateError instanceof Error ? updateError.message : updateError,
        );
      }
    }
  }

  /**
   * Push a deliverable to the client's delivery endpoint via HTTP POST.
   *
   * Validates the delivery URL before making the request to prevent
   * SSRF attacks (only HTTP/HTTPS schemes allowed, private IPs blocked).
   *
   * @param deliveryEndpoint - The URL to POST the deliverable to
   * @param deliverable - The deliverable to send
   * @throws IVXPError if the URL is invalid or uses a blocked scheme
   * @throws Error if the push fails (network error or non-2xx response)
   */
  private async pushDeliverable(
    deliveryEndpoint: string,
    deliverable: StoredDeliverable,
  ): Promise<void> {
    validateDeliveryUrl(deliveryEndpoint, this.allowPrivateDeliveryUrls);

    const body =
      deliverable.content instanceof Uint8Array
        ? {
            order_id: deliverable.orderId,
            content: uint8ArrayToBase64(deliverable.content),
            content_encoding: "base64",
            content_type: deliverable.contentType,
            content_hash: deliverable.contentHash,
          }
        : {
            order_id: deliverable.orderId,
            content: deliverable.content,
            content_type: deliverable.contentType,
            content_hash: deliverable.contentHash,
          };

    const response = await fetch(deliveryEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Push delivery failed: ${response.status} ${response.statusText}`);
    }
  }
}

// ---------------------------------------------------------------------------
// URL validation for push delivery (SSRF prevention)
// ---------------------------------------------------------------------------

/**
 * IPv4 patterns considered private/internal per RFC 1918 and RFC 5735.
 *
 * Blocks loopback (127.x), link-local (169.254.x), and private ranges
 * (10.x, 172.16-31.x, 192.168.x) to prevent SSRF attacks.
 */
const PRIVATE_IPV4_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
] as const;

/**
 * Validate that a delivery URL is safe for outbound HTTP requests.
 *
 * Checks:
 * - URL is syntactically valid
 * - Scheme is http: or https:
 * - Hostname is not localhost or a private IPv4 address
 *
 * @param url - The URL to validate
 * @param allowPrivate - If true, skip private IP / localhost checks
 * @throws IVXPError if the URL is invalid or targets a blocked destination
 */
function validateDeliveryUrl(url: string, allowPrivate = false): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new IVXPError(`Invalid delivery URL: ${url}`, "INVALID_DELIVERY_URL", { url });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new IVXPError(
      `Unsupported delivery URL scheme: ${parsed.protocol}`,
      "INVALID_DELIVERY_URL",
      { url, protocol: parsed.protocol },
    );
  }

  if (allowPrivate) {
    return;
  }

  const hostname = parsed.hostname;

  if (hostname === "localhost" || hostname === "[::1]") {
    throw new IVXPError("Delivery URL must not target localhost", "INVALID_DELIVERY_URL", {
      url,
      hostname,
    });
  }

  for (const pattern of PRIVATE_IPV4_PATTERNS) {
    if (pattern.test(hostname)) {
      throw new IVXPError(
        "Delivery URL must not target private/internal networks",
        "INVALID_DELIVERY_URL",
        { url, hostname },
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Binary content encoding utility
// ---------------------------------------------------------------------------

/**
 * Encode a Uint8Array as a base64 string for JSON transport.
 *
 * Uses Buffer.from().toString("base64") at runtime but avoids Buffer
 * in the type signature for cross-platform compatibility.
 */
function uint8ArrayToBase64(data: Uint8Array): string {
  // Buffer is available at runtime in Node.js and is a Uint8Array subclass.
  // Cast through unknown to avoid @types/node dependency in DTS build.
  const g = globalThis as Record<string, unknown>;
  const BufferCtor = g["Buffer"] as
    | { from: (data: Uint8Array) => { toString: (encoding: string) => string } }
    | undefined;

  if (BufferCtor) {
    return BufferCtor.from(data).toString("base64");
  }

  // Fallback for non-Node environments (unlikely in provider context)
  let binary = "";
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return globalThis.btoa(binary);
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
 * Enforces a maximum body size (MAX_REQUEST_BODY_SIZE) to prevent
 * denial-of-service attacks via oversized request bodies.
 *
 * Avoids `Buffer` type references to maintain @types/node independence.
 * Instead, treats chunks as opaque values and uses the TextDecoder API
 * (available in Node.js 20+) for string conversion.
 */
function readRequestBody(req: IncomingMsg): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    let totalBytes = 0;

    req.on("data", (chunk: unknown) => {
      const chunkStr = String(chunk);
      totalBytes += chunkStr.length;

      if (totalBytes > MAX_REQUEST_BODY_SIZE) {
        reject(
          new IVXPError(
            `Request body too large: exceeds ${MAX_REQUEST_BODY_SIZE} bytes`,
            "REQUEST_TOO_LARGE",
          ),
        );
        return;
      }

      body += chunkStr;
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
