/**
 * IVXPClient -- Main client class for the IVXP SDK.
 *
 * Provides a unified entry point for interacting with the IVXP protocol.
 * Internally initializes CryptoService, PaymentService, and HttpClient,
 * with dependency injection support for testing.
 */

import { z } from "zod";
import type {
  ICryptoService,
  IPaymentService,
  IHttpClient,
  JsonSerializable,
  SDKEvent,
  SDKEventMap,
} from "@ivxp/protocol";
import {
  PROTOCOL_VERSION,
  ServiceCatalogSchema,
  ServiceQuoteSchema,
  OrderStatusResponseSchema,
  type ServiceCatalogOutput,
  type ServiceQuoteOutput,
  type OrderStatusResponseOutput,
} from "@ivxp/protocol";
import { createCryptoService, formatIVXPMessage } from "../crypto/index.js";
import { PaymentService, type NetworkType } from "../payment/index.js";
import { createHttpClient } from "../http/index.js";
import { IVXPError } from "../errors/base.js";
import { PartialSuccessError, ServiceUnavailableError } from "../errors/specific.js";
import { pollWithBackoff, type PollOptions } from "../polling/index.js";
import type { ServiceRequestParams, SubmitPaymentQuote, PaymentResult } from "./types.js";

// ---------------------------------------------------------------------------
// Validation constants
// ---------------------------------------------------------------------------

/** Regex for a valid 0x-prefixed 32-byte hex private key (66 chars total). */
const PRIVATE_KEY_REGEX = /^0x[0-9a-fA-F]{64}$/;

/** Regex for a valid 0x-prefixed 20-byte hex address (42 chars total). */
const HEX_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;

/** The Ethereum zero address (20 zero bytes). */
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/** Allowed URL protocols for provider URLs. */
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/** Default name for the SDK client agent in wire-format messages. */
const SDK_CLIENT_NAME = "IVXP SDK Client";

/** Valid delivery format values for runtime validation. */
const VALID_DELIVERY_FORMATS = new Set(["markdown", "json", "code"]);

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

/**
 * Validate ServiceRequestParams at runtime.
 *
 * Checks all required fields for emptiness, type correctness, and
 * domain constraints. Called at the start of requestQuote() to fail
 * fast before making any network requests.
 *
 * @param params - The request parameters to validate
 * @throws IVXPError with code INVALID_REQUEST_PARAMS if any field is invalid
 */
function validateRequestParams(params: ServiceRequestParams): void {
  if (!params.serviceType || params.serviceType.trim().length === 0) {
    throw new IVXPError(
      "Invalid request params: serviceType must be a non-empty string",
      "INVALID_REQUEST_PARAMS",
      { field: "serviceType" },
    );
  }

  if (!params.description || params.description.trim().length === 0) {
    throw new IVXPError(
      "Invalid request params: description must be a non-empty string",
      "INVALID_REQUEST_PARAMS",
      { field: "description" },
    );
  }

  if (
    typeof params.budgetUsdc !== "number" ||
    !Number.isFinite(params.budgetUsdc) ||
    params.budgetUsdc <= 0
  ) {
    throw new IVXPError(
      "Invalid request params: budgetUsdc must be a positive finite number",
      "INVALID_REQUEST_PARAMS",
      { field: "budgetUsdc", value: params.budgetUsdc },
    );
  }

  if (params.deliveryFormat !== undefined && !VALID_DELIVERY_FORMATS.has(params.deliveryFormat)) {
    throw new IVXPError(
      `Invalid request params: deliveryFormat must be one of "markdown", "json", "code"`,
      "INVALID_REQUEST_PARAMS",
      { field: "deliveryFormat", value: params.deliveryFormat },
    );
  }

  if (params.deadline !== undefined) {
    if (!(params.deadline instanceof Date) || isNaN(params.deadline.getTime())) {
      throw new IVXPError(
        "Invalid request params: deadline must be a valid Date",
        "INVALID_REQUEST_PARAMS",
        { field: "deadline" },
      );
    }

    if (params.deadline.getTime() <= Date.now()) {
      throw new IVXPError(
        "Invalid request params: deadline must be in the future",
        "INVALID_REQUEST_PARAMS",
        { field: "deadline" },
      );
    }
  }
}

/**
 * Validate an orderId for order status and polling methods.
 *
 * Rejects empty strings and strings containing pipe characters.
 * Matches the same validation pattern used in submitPayment.
 *
 * @param orderId - The order ID to validate
 * @throws IVXPError with code INVALID_REQUEST_PARAMS if the orderId is invalid
 */
function validateOrderId(orderId: string): void {
  if (!orderId || orderId.trim().length === 0) {
    throw new IVXPError(
      "Invalid request params: orderId must be a non-empty string",
      "INVALID_REQUEST_PARAMS",
      { field: "orderId" },
    );
  }

  if (orderId.includes("|")) {
    throw new IVXPError(
      "Invalid request params: orderId must not contain pipe character (|)",
      "INVALID_REQUEST_PARAMS",
      { field: "orderId" },
    );
  }
}

/**
 * Validate submitPayment parameters at runtime.
 *
 * Checks orderId and quote fields for emptiness and domain constraints.
 * Called at the start of submitPayment() to fail fast before on-chain ops.
 */
function validateSubmitPaymentParams(orderId: string, quote: SubmitPaymentQuote): void {
  if (!orderId || orderId.trim().length === 0) {
    throw new IVXPError(
      "Invalid request params: orderId must be a non-empty string",
      "INVALID_REQUEST_PARAMS",
      { field: "orderId" },
    );
  }

  // Reject pipe characters early so formatIVXPMessage does not throw
  // after the on-chain payment has already been sent (which would cause
  // a PartialSuccessError for a preventable validation issue).
  if (orderId.includes("|")) {
    throw new IVXPError(
      "Invalid request params: orderId must not contain pipe character (|)",
      "INVALID_REQUEST_PARAMS",
      { field: "orderId" },
    );
  }

  if (
    typeof quote.priceUsdc !== "number" ||
    !Number.isFinite(quote.priceUsdc) ||
    quote.priceUsdc <= 0
  ) {
    throw new IVXPError(
      "Invalid request params: priceUsdc must be a positive finite number",
      "INVALID_REQUEST_PARAMS",
      { field: "priceUsdc", value: quote.priceUsdc },
    );
  }

  if (!quote.paymentAddress || !HEX_ADDRESS_REGEX.test(quote.paymentAddress)) {
    throw new IVXPError(
      "Invalid request params: paymentAddress must be a valid 0x-prefixed 40-character hex address",
      "INVALID_REQUEST_PARAMS",
      { field: "paymentAddress", value: quote.paymentAddress },
    );
  }

  if (quote.paymentAddress === ZERO_ADDRESS) {
    throw new IVXPError(
      "Invalid request params: paymentAddress must not be the zero address",
      "INVALID_REQUEST_PARAMS",
      { field: "paymentAddress", value: quote.paymentAddress },
    );
  }
}

// ---------------------------------------------------------------------------
// Wire-format types (for requestQuote body construction)
// ---------------------------------------------------------------------------

/**
 * Wire-format client agent identification.
 * Matches the snake_case structure expected by POST /ivxp/request.
 */
interface WireFormatClientAgent {
  readonly name: string;
  readonly wallet_address: string;
  readonly contact_endpoint?: string;
}

/**
 * Wire-format service request details.
 * Matches the snake_case structure expected by POST /ivxp/request.
 */
interface WireFormatServiceRequest {
  readonly type: string;
  readonly description: string;
  readonly budget_usdc: number;
  readonly delivery_format?: string;
  readonly deadline?: string;
}

/**
 * Complete wire-format service request message.
 * Sent as the POST body to {providerUrl}/ivxp/request.
 */
interface WireFormatServiceRequestMessage {
  readonly protocol: string;
  readonly message_type: "service_request";
  readonly timestamp: string;
  readonly client_agent: WireFormatClientAgent;
  readonly service_request: WireFormatServiceRequest;
}

// ---------------------------------------------------------------------------
// Wire-format types (for submitPayment body construction)
// ---------------------------------------------------------------------------

/**
 * Wire-format payment details. Matches story spec: { tx_hash, amount_usdc, network }.
 */
interface WireFormatPayment {
  readonly tx_hash: string;
  readonly amount_usdc: string;
  readonly network: string;
}

/**
 * Wire-format signature details. Matches story spec: { message, sig, signer }.
 */
interface WireFormatSignature {
  readonly message: string;
  readonly sig: string;
  readonly signer: string;
}

/**
 * Wire-format payment proof message for POST /ivxp/orders/{orderId}/payment.
 */
interface WireFormatPaymentProofMessage {
  readonly protocol: string;
  readonly message_type: "payment_proof";
  readonly timestamp: string;
  readonly order_id: string;
  readonly payment: WireFormatPayment;
  readonly signature: WireFormatSignature;
}

/** USDC decimal precision for amount formatting. */
const USDC_DECIMAL_PLACES = 6;

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
 * Configuration options for order polling methods.
 *
 * Extends the base PollOptions with an optional `targetStatuses` array
 * that determines which order statuses terminate the polling loop.
 */
export interface OrderPollOptions extends PollOptions {
  /** Order statuses that terminate polling. Defaults to ['delivered', 'delivery_failed']. */
  readonly targetStatuses?: readonly string[];
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
 * @example
 * ```typescript
 * const client = createIVXPClient({ privateKey: "0x..." });
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
  // Request Quote
  // -------------------------------------------------------------------------

  /**
   * Request a service quote from a provider.
   *
   * Builds a wire-format service request message with auto-injected client
   * info (wallet address, timestamp, protocol version), sends it via
   * POST to `{providerUrl}/ivxp/request`, validates the response against
   * the ServiceQuote Zod schema, and emits an 'order.quoted' event on success.
   *
   * @param providerUrl - Base URL of the provider (e.g. "http://provider.example.com")
   * @param params - Service request parameters (serviceType, description, budgetUsdc, etc.)
   * @returns Validated and typed ServiceQuote with camelCase fields
   * @throws IVXPError with code INVALID_PROVIDER_URL if providerUrl is not a valid HTTP(S) URL
   * @throws IVXPError with code INVALID_REQUEST_PARAMS if request parameters fail validation
   * @throws IVXPError with code INVALID_QUOTE_FORMAT if response fails Zod validation
   * @throws ServiceUnavailableError if the provider is unreachable or returns a network error
   */
  async requestQuote(
    providerUrl: string,
    params: ServiceRequestParams,
  ): Promise<ServiceQuoteOutput> {
    validateRequestParams(params);
    const normalizedUrl = validateProviderUrl(providerUrl);
    const requestUrl = `${normalizedUrl}/ivxp/request`;

    // Auto-inject client info into wire-format request
    const walletAddress = await this.getAddress();

    // Build client_agent, omitting undefined optional fields
    const clientAgent: WireFormatClientAgent = {
      name: SDK_CLIENT_NAME,
      wallet_address: walletAddress,
      ...(params.contactEndpoint !== undefined && {
        contact_endpoint: params.contactEndpoint,
      }),
    };

    // Build service_request, omitting undefined optional fields
    const serviceRequest: WireFormatServiceRequest = {
      type: params.serviceType,
      description: params.description,
      budget_usdc: params.budgetUsdc,
      ...(params.deliveryFormat !== undefined && {
        delivery_format: params.deliveryFormat,
      }),
      ...(params.deadline !== undefined && {
        deadline: params.deadline.toISOString(),
      }),
    };

    const request: WireFormatServiceRequestMessage = {
      protocol: PROTOCOL_VERSION,
      message_type: "service_request" as const,
      timestamp: new Date().toISOString(),
      client_agent: clientAgent,
      service_request: serviceRequest,
    };

    try {
      // Cast is safe: conditional spreads above guarantee no undefined
      // values exist in the serialized object. TypeScript cannot verify
      // this through the recursive JsonSerializable type.
      const rawResponse = await this.httpClient.post<unknown>(
        requestUrl,
        request as unknown as JsonSerializable,
      );

      // Validate and transform wire-format JSON using Zod schema
      const quote = ServiceQuoteSchema.parse(rawResponse);

      // Emit event on successful quote
      this.emit("order.quoted", {
        orderId: quote.orderId,
        priceUsdc: String(quote.quote.priceUsdc),
      });

      return quote;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new IVXPError(
          `Invalid quote format from ${normalizedUrl}: ${error.issues.length} validation issue(s)`,
          "INVALID_QUOTE_FORMAT",
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
        `Failed to request quote from ${normalizedUrl}: ${errorMessage}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Submit Payment
  // -------------------------------------------------------------------------

  /**
   * Submit payment for a quoted order and notify the provider.
   *
   * Sends USDC on-chain, creates an EIP-191 signed payment proof
   * (IVXP/1.0 message format), and posts the proof to the provider's
   * payment endpoint at `/ivxp/orders/{orderId}/payment`. Emits
   * 'payment.sent' after tx success and 'order.paid' after provider
   * notification.
   *
   * If the on-chain payment succeeds but provider notification fails,
   * throws a PartialSuccessError containing the txHash for recovery.
   *
   * @param providerUrl - Base URL of the provider (e.g. "http://provider.example.com")
   * @param orderId - The order identifier from a previous requestQuote() call
   * @param quote - Quote details with priceUsdc and paymentAddress
   * @returns PaymentResult with orderId, txHash, and updated status
   * @throws IVXPError with code INVALID_PROVIDER_URL if providerUrl is not a valid HTTP(S) URL
   * @throws IVXPError with code INVALID_REQUEST_PARAMS if orderId or quote fields are invalid
   * @throws PartialSuccessError if payment tx succeeds but provider notification fails
   * @throws Error if the on-chain payment fails (pre-notification)
   */
  async submitPayment(
    providerUrl: string,
    orderId: string,
    quote: SubmitPaymentQuote,
  ): Promise<PaymentResult> {
    // 1. Validate inputs (fail fast before any side effects)
    validateSubmitPaymentParams(orderId, quote);
    const normalizedUrl = validateProviderUrl(providerUrl);
    const paymentUrl = `${normalizedUrl}/ivxp/orders/${encodeURIComponent(orderId)}/payment`;

    // 2. Send USDC payment on-chain
    // toFixed(6) is safe here: USDC amounts in quotes are typically small
    // numbers (< 1M) where IEEE 754 double precision is exact to 6 decimals.
    // The upstream validation ensures priceUsdc is a finite positive number.
    const amountStr = quote.priceUsdc.toFixed(USDC_DECIMAL_PLACES);
    const txHash = await this.paymentService.send(quote.paymentAddress, amountStr);

    // 3. Emit 'payment.sent' event after successful on-chain tx
    this.emit("payment.sent", { txHash });

    // 4. Sign IVXP payment proof message
    const timestamp = new Date().toISOString();
    const walletAddress = await this.getAddress();
    const message = formatIVXPMessage({ orderId, txHash, timestamp });
    const signature = await this.cryptoService.sign(message);

    // 5. Build wire-format payment proof (story spec format)
    const paymentProof: WireFormatPaymentProofMessage = {
      protocol: PROTOCOL_VERSION,
      message_type: "payment_proof",
      timestamp,
      order_id: orderId,
      payment: {
        tx_hash: txHash,
        amount_usdc: amountStr,
        network: this.network,
      },
      signature: {
        message,
        sig: signature,
        signer: walletAddress,
      },
    };

    // 6. Notify provider (POST payment proof)
    try {
      await this.httpClient.post<unknown>(paymentUrl, paymentProof as unknown as JsonSerializable);
    } catch (notificationError) {
      // Payment succeeded but notification failed -- partial success
      const cause = notificationError instanceof Error ? notificationError : undefined;
      throw new PartialSuccessError(
        "Payment sent but provider notification failed",
        txHash,
        true,
        cause,
      );
    }

    // 7. Emit 'order.paid' event after successful notification
    this.emit("order.paid", { orderId, txHash });

    // 8. Return payment result
    return {
      orderId,
      txHash,
      status: "paid",
    };
  }

  // -------------------------------------------------------------------------
  // Order Status
  // -------------------------------------------------------------------------

  /**
   * Fetch the current status of an order from a provider.
   *
   * Makes a GET request to `{providerUrl}/ivxp/orders/{orderId}`, validates
   * the response against the OrderStatusResponse Zod schema (which transforms
   * wire-format snake_case to camelCase).
   *
   * @param providerUrl - Base URL of the provider (e.g. "http://provider.example.com")
   * @param orderId - The order identifier to check
   * @returns Validated and typed OrderStatusResponseOutput with camelCase fields
   * @throws IVXPError with code INVALID_PROVIDER_URL if providerUrl is not a valid HTTP(S) URL
   * @throws IVXPError with code INVALID_REQUEST_PARAMS if orderId is invalid
   * @throws IVXPError with code INVALID_ORDER_STATUS_FORMAT if response fails Zod validation
   * @throws ServiceUnavailableError if the provider is unreachable or returns a network error
   */
  async getOrderStatus(providerUrl: string, orderId: string): Promise<OrderStatusResponseOutput> {
    validateOrderId(orderId);
    const normalizedUrl = validateProviderUrl(providerUrl);
    const statusUrl = `${normalizedUrl}/ivxp/orders/${encodeURIComponent(orderId)}`;

    try {
      const rawResponse = await this.httpClient.get<unknown>(statusUrl);

      // Validate and transform wire-format JSON using Zod schema
      const orderStatus = OrderStatusResponseSchema.parse(rawResponse);

      return orderStatus;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new IVXPError(
          `Invalid order status format from ${normalizedUrl}: ${error.issues.length} validation issue(s)`,
          "INVALID_ORDER_STATUS_FORMAT",
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
        `Failed to fetch order status from ${normalizedUrl}: ${errorMessage}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Poll Order Until
  // -------------------------------------------------------------------------

  /**
   * Poll an order's status until it reaches one of the target statuses.
   *
   * Uses exponential backoff with jitter between attempts. Emits
   * 'order.status_changed' events when the status changes between polls.
   *
   * @param providerUrl - Base URL of the provider
   * @param orderId - The order identifier to poll
   * @param options - Polling configuration (extends PollOptions with targetStatuses)
   * @returns The final order status when a target status is reached
   * @throws MaxPollAttemptsError if max attempts are exceeded
   * @throws Error if the abort signal fires
   */
  async pollOrderUntil(
    providerUrl: string,
    orderId: string,
    options: OrderPollOptions = {},
  ): Promise<OrderStatusResponseOutput> {
    const {
      targetStatuses = ["delivered", "delivery_failed"],
      initialDelay,
      maxDelay,
      maxAttempts,
      jitter,
      signal,
    } = options;

    // Track previous status for change detection.
    // This is local mutable state within the closure -- acceptable per spec.
    let previousStatus: string | null = null;

    return pollWithBackoff(
      async () => {
        const orderStatus = await this.getOrderStatus(providerUrl, orderId);

        // Emit status change event if status differs from previous
        if (orderStatus.status !== previousStatus) {
          this.emit("order.status_changed", {
            orderId: orderStatus.orderId,
            previousStatus,
            newStatus: orderStatus.status,
          });
          previousStatus = orderStatus.status;
        }

        // Return the order if target status is reached, null to continue polling
        if (targetStatuses.includes(orderStatus.status)) {
          return orderStatus;
        }

        return null;
      },
      { initialDelay, maxDelay, maxAttempts, jitter, signal },
    );
  }

  // -------------------------------------------------------------------------
  // Wait For Delivery (convenience)
  // -------------------------------------------------------------------------

  /**
   * Convenience method to poll until an order is delivered or fails.
   *
   * Equivalent to `pollOrderUntil` with targetStatuses ['delivered', 'delivery_failed'].
   *
   * @param providerUrl - Base URL of the provider
   * @param orderId - The order identifier to poll
   * @param options - Polling configuration (PollOptions only, targetStatuses is preset)
   * @returns The final order status when delivered or delivery failed
   */
  async waitForDelivery(
    providerUrl: string,
    orderId: string,
    options: Omit<OrderPollOptions, "targetStatuses"> = {},
  ): Promise<OrderStatusResponseOutput> {
    return this.pollOrderUntil(providerUrl, orderId, {
      ...options,
      targetStatuses: ["delivered", "delivery_failed"],
    });
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
