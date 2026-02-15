/**
 * IVXPClient -- Main client class for the IVXP SDK.
 *
 * Provides a unified entry point for interacting with the IVXP protocol.
 * Internally initializes CryptoService, PaymentService, and HttpClient,
 * with dependency injection support for testing.
 *
 * Features:
 * - One-line construction with just a private key
 * - Default network: Base Sepolia
 * - Internal service initialization (crypto, payment, HTTP)
 * - Dependency injection for all services
 * - Factory function with input validation
 * - Type-safe event emission for SDK lifecycle events
 * - Service catalog fetching with Zod validation
 */

import { z } from "zod";
import type {
  ICryptoService,
  IPaymentService,
  IHttpClient,
  SDKEvent,
  SDKEventMap,
} from "@ivxp/protocol";
import { ServiceCatalogSchema, type ServiceCatalogOutput } from "@ivxp/protocol";
import { createCryptoService } from "../crypto/index.js";
import { PaymentService, type NetworkType } from "../payment/index.js";
import { createHttpClient } from "../http/index.js";
import { IVXPError } from "../errors/base.js";
import { ServiceUnavailableError } from "../errors/specific.js";

// ---------------------------------------------------------------------------
// Validation constants
// ---------------------------------------------------------------------------

/** Regex for a valid 0x-prefixed 32-byte hex private key (66 chars total). */
const PRIVATE_KEY_REGEX = /^0x[0-9a-fA-F]{64}$/;

/** Allowed URL protocols for provider URLs. */
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Validate and normalize a provider URL.
 *
 * Ensures the URL is parseable, uses http or https, and strips
 * trailing slashes.
 *
 * @param providerUrl - Raw provider URL string
 * @returns Normalized URL string (no trailing slashes)
 * @throws IVXPError with code INVALID_PROVIDER_URL if the URL is invalid
 */
function validateProviderUrl(providerUrl: string): string {
  if (!providerUrl || providerUrl.trim().length === 0) {
    throw new IVXPError("Invalid provider URL: URL must not be empty", "INVALID_PROVIDER_URL");
  }

  let parsed: URL;
  try {
    parsed = new URL(providerUrl);
  } catch {
    throw new IVXPError(
      `Invalid provider URL: "${providerUrl}" is not a valid URL`,
      "INVALID_PROVIDER_URL",
      { url: providerUrl },
    );
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new IVXPError(
      `Invalid provider URL: protocol must be http or https, got "${parsed.protocol}"`,
      "INVALID_PROVIDER_URL",
      { url: providerUrl, protocol: parsed.protocol },
    );
  }

  // Strip trailing slashes from origin + pathname
  return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, "");
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Configuration for creating an IVXPClient instance.
 */
export interface IVXPClientConfig {
  /** The 0x-prefixed hex private key for signing and payments (32 bytes). */
  readonly privateKey: `0x${string}`;

  /** The network to use. Defaults to "base-sepolia". */
  readonly network?: NetworkType;

  /** Optional: Custom HTTP client for testing or custom transport. */
  readonly httpClient?: IHttpClient;

  /** Optional: Custom crypto service for testing. */
  readonly cryptoService?: ICryptoService;

  /** Optional: Custom payment service for testing. */
  readonly paymentService?: IPaymentService;
}

/**
 * Type alias for event handler functions.
 *
 * Uses the union base type `SDKEvent["type"]` rather than a specific
 * event literal `T` to allow storing handlers for different event types
 * in the same Map value array. This is safe because emit() is generic
 * and only calls handlers registered for the matching event type.
 */
type EventHandler<T extends SDKEvent["type"]> = (payload: SDKEventMap[T]) => void;

// ---------------------------------------------------------------------------
// IVXPClient
// ---------------------------------------------------------------------------

/**
 * Main client for the IVXP protocol.
 *
 * Provides access to cryptographic signing, USDC payments, HTTP
 * communication, and service catalog fetching. Services are created
 * internally by default but can be overridden via dependency injection
 * for testing.
 *
 * Implements a lightweight type-safe event emitter for SDK lifecycle
 * events (catalog.received, order.*, payment.*).
 *
 * @example
 * ```typescript
 * import { createIVXPClient } from "@ivxp/sdk";
 *
 * const client = createIVXPClient({
 *   privateKey: "0x...",
 * });
 *
 * const address = await client.getAddress();
 * const catalog = await client.getCatalog("http://provider.example.com");
 * ```
 */
export class IVXPClient {
  private readonly cryptoService: ICryptoService;
  private readonly paymentService: IPaymentService;
  private readonly httpClient: IHttpClient;
  private readonly network: NetworkType;

  /**
   * Event handler registry. Maps event type strings to arrays of handlers.
   * Uses Map for O(1) lookup by event type.
   */
  private readonly eventHandlers = new Map<string, Array<EventHandler<SDKEvent["type"]>>>();

  /**
   * Create a new IVXPClient instance.
   *
   * Validates the private key format. Prefer using the `createIVXPClient`
   * factory function which provides more specific error messages.
   *
   * @param config - Client configuration with privateKey and optional overrides
   * @throws If the private key format is invalid
   */
  constructor(config: IVXPClientConfig) {
    const { privateKey, network = "base-sepolia" } = config;

    if (!privateKey || !PRIVATE_KEY_REGEX.test(privateKey)) {
      throw new Error(
        "Invalid private key: must be a 0x-prefixed 64-character hex string (32 bytes)",
      );
    }

    this.network = network;

    // Initialize services with DI support: use injected service if provided,
    // otherwise create a default implementation.
    this.cryptoService = config.cryptoService ?? createCryptoService(privateKey);

    this.paymentService = config.paymentService ?? new PaymentService({ privateKey, network });

    this.httpClient = config.httpClient ?? createHttpClient();
  }

  // -------------------------------------------------------------------------
  // Getters
  // -------------------------------------------------------------------------

  /**
   * Get the wallet address for this client.
   *
   * Delegates to the crypto service. Async because ICryptoService.getAddress()
   * is async to support wallet-switching scenarios.
   *
   * @returns The hex-encoded wallet address (0x-prefixed, checksummed)
   */
  async getAddress(): Promise<`0x${string}`> {
    return this.cryptoService.getAddress();
  }

  /**
   * Get the network this client is configured for.
   *
   * @returns The network type ("base-mainnet" or "base-sepolia")
   */
  getNetwork(): NetworkType {
    return this.network;
  }

  /**
   * Get the USDC balance for this client's wallet.
   *
   * Delegates to the payment service, passing the client's own address.
   *
   * @returns USDC balance as a human-readable decimal string (e.g. "100.500000")
   */
  async getBalance(): Promise<string> {
    const address = await this.getAddress();
    return this.paymentService.getBalance(address);
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

  /** Access the underlying HTTP client. */
  get http(): IHttpClient {
    return this.httpClient;
  }

  // -------------------------------------------------------------------------
  // Event emitter
  // -------------------------------------------------------------------------

  /**
   * Subscribe to an SDK event.
   *
   * Handlers are invoked synchronously in registration order when the
   * corresponding event is emitted. This method is designed for use in
   * JavaScript's single-threaded execution model -- concurrent calls
   * from the same event loop turn are not expected.
   *
   * @typeParam T - Event type string literal
   * @param event - The event type to listen for
   * @param handler - Callback invoked with the event's typed payload
   */
  on<T extends SDKEvent["type"]>(event: T, handler: (payload: SDKEventMap[T]) => void): void {
    const handlers = this.eventHandlers.get(event) ?? [];
    this.eventHandlers.set(event, [...handlers, handler as EventHandler<SDKEvent["type"]>]);
  }

  /**
   * Unsubscribe from an SDK event.
   *
   * @typeParam T - Event type string literal
   * @param event - The event type to stop listening for
   * @param handler - The previously registered handler to remove
   */
  off<T extends SDKEvent["type"]>(event: T, handler: (payload: SDKEventMap[T]) => void): void {
    const handlers = this.eventHandlers.get(event);
    if (!handlers) {
      return;
    }
    const remaining = handlers.filter((h) => h !== handler);
    if (remaining.length === 0) {
      this.eventHandlers.delete(event);
    } else {
      this.eventHandlers.set(event, remaining);
    }
  }

  // -------------------------------------------------------------------------
  // Catalog
  // -------------------------------------------------------------------------

  /**
   * Fetch service catalog from a provider.
   *
   * Makes a GET request to `{providerUrl}/ivxp/catalog`, validates the
   * response against the ServiceCatalog Zod schema (which transforms
   * wire-format snake_case to camelCase), and emits a 'catalog.received'
   * event on success.
   *
   * @param providerUrl - Base URL of the provider (e.g. "http://provider.example.com")
   * @returns Validated and typed ServiceCatalog with camelCase fields
   * @throws IVXPError with code INVALID_PROVIDER_URL if providerUrl is not a valid HTTP(S) URL
   * @throws IVXPError with code INVALID_CATALOG_FORMAT if response fails Zod validation
   * @throws ServiceUnavailableError if the provider is unreachable or returns a network error
   */
  async getCatalog(providerUrl: string): Promise<ServiceCatalogOutput> {
    const normalizedUrl = validateProviderUrl(providerUrl);
    const catalogUrl = `${normalizedUrl}/ivxp/catalog`;

    try {
      const rawResponse = await this.httpClient.get<unknown>(catalogUrl);

      // Validate and transform wire-format JSON using Zod schema
      const catalog = ServiceCatalogSchema.parse(rawResponse);

      // Emit event on successful fetch
      this.emit("catalog.received", {
        provider: catalog.provider,
        servicesCount: catalog.services.length,
      });

      return catalog;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new IVXPError(
          `Invalid catalog format from ${normalizedUrl}: ${error.issues.length} validation issue(s)`,
          "INVALID_CATALOG_FORMAT",
          { issueCount: error.issues.length },
          error,
        );
      }

      if (error instanceof IVXPError) {
        throw error;
      }

      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "Unknown error";

      throw new ServiceUnavailableError(
        `Failed to fetch catalog from ${normalizedUrl}: ${errorMessage}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Emit an SDK event with a typed payload.
   *
   * Invokes all registered handlers for the given event type.
   * Handlers are called synchronously in registration order.
   * Each handler is wrapped in try-catch to ensure that a throwing
   * handler does not prevent subsequent handlers from executing
   * and does not propagate to the caller.
   */
  private emit<T extends SDKEvent["type"]>(event: T, payload: SDKEventMap[T]): void {
    const handlers = this.eventHandlers.get(event);
    if (!handlers) {
      return;
    }
    for (const handler of handlers) {
      try {
        handler(payload);
      } catch {
        // Swallow handler errors to isolate event observers from
        // each other and from the emitting code path (getCatalog, etc.).
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Factory function
// ---------------------------------------------------------------------------

/**
 * Create a new IVXPClient instance with input validation.
 *
 * Validates the private key format before constructing the client.
 * Prefer this over `new IVXPClient()` for safer construction.
 *
 * @param config - Client configuration
 * @returns A configured IVXPClient instance
 * @throws If the private key format is invalid
 *
 * @example
 * ```typescript
 * import { createIVXPClient } from "@ivxp/sdk";
 *
 * // Minimal usage
 * const client = createIVXPClient({
 *   privateKey: "0x...",
 * });
 *
 * // With custom network
 * const mainnetClient = createIVXPClient({
 *   privateKey: "0x...",
 *   network: "base-mainnet",
 * });
 *
 * // With dependency injection for testing
 * const testClient = createIVXPClient({
 *   privateKey: "0x...",
 *   cryptoService: mockCrypto,
 *   paymentService: mockPayment,
 * });
 * ```
 */
export function createIVXPClient(config: IVXPClientConfig): IVXPClient {
  if (!config.privateKey) {
    throw new Error("Missing private key: config.privateKey is required");
  }

  if (!PRIVATE_KEY_REGEX.test(config.privateKey)) {
    throw new Error(
      "Invalid private key: must be a 0x-prefixed 64-character hex string (32 bytes)",
    );
  }

  return new IVXPClient(config);
}
