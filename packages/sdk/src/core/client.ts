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
  SDKEventMap,
} from "@ivxp/protocol";
import { EventEmitter } from "./events.js";
import {
  PROTOCOL_VERSION,
  ServiceCatalogSchema,
  ServiceQuoteSchema,
  OrderStatusResponseSchema,
  DeliveryResponseSchema,
  DeliveryAcceptedSchema,
  type ServiceCatalogOutput,
  type ServiceQuoteOutput,
  type OrderStatusResponseOutput,
  type DeliveryResponseOutput,
} from "@ivxp/protocol";
import { createCryptoService, formatIVXPMessage } from "../crypto/index.js";
import { PaymentService, type NetworkType } from "../payment/index.js";
import { createHttpClient } from "../http/index.js";
import { IVXPError } from "../errors/base.js";
import {
  BudgetExceededError,
  PartialSuccessError,
  ProviderError,
  ServiceUnavailableError,
  TimeoutError,
} from "../errors/specific.js";
import { pollWithBackoff, type PollOptions } from "../polling/index.js";
import {
  createCallbackServer,
  type CallbackServerOptions,
  type CallbackServerResult,
  type RejectionDetails,
} from "./callback-server.js";
import {
  SSEClient,
  SSEExhaustedError,
  type SSEConnectOptions,
  type SSEHandlers,
} from "../sse/index.js";
import type {
  ServiceRequestParams,
  SubmitPaymentQuote,
  PaymentResult,
  DownloadOptions,
  ConfirmationResult,
  RequestServiceParams,
  RequestServiceResult,
} from "./types.js";

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
 *
 * Delegates orderId validation to `validateOrderId` to avoid duplication.
 */
function validateSubmitPaymentParams(orderId: string, quote: SubmitPaymentQuote): void {
  validateOrderId(orderId);

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
// Wire-format types (for confirmDelivery body construction)
// ---------------------------------------------------------------------------

/**
 * Wire-format confirmation details.
 * Matches the IVXP/1.0 wire protocol for delivery_confirmation messages.
 */
interface WireFormatConfirmation {
  readonly message: string;
  readonly signature: string;
  readonly signer: string;
}

/**
 * Wire-format delivery confirmation message for POST /ivxp/orders/{orderId}/confirm.
 */
interface WireFormatDeliveryConfirmationMessage {
  readonly protocol: string;
  readonly message_type: "delivery_confirmation";
  readonly timestamp: string;
  readonly order_id: string;
  readonly confirmation: WireFormatConfirmation;
}

/**
 * Zod schema for the provider's confirmation response.
 *
 * Validates the `confirmed_at` field as a valid ISO 8601 timestamp
 * and `status` as the literal string "confirmed".
 */
const ConfirmationResponseSchema = z.object({
  status: z.literal("confirmed"),
  confirmed_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/, {
      message: "Invalid ISO 8601 timestamp in confirmed_at",
    }),
});

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

  /**
   * Optional: Callback server configuration for push delivery reception.
   *
   * When provided, the client can start a callback server to receive
   * push deliveries from Providers. Use `startCallbackServer()` to
   * start the server and `getCallbackUrl()` to get the URL for
   * inclusion in service requests.
   */
  readonly callbackServer?: CallbackServerOptions;
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

// ---------------------------------------------------------------------------
// IVXPClient
// ---------------------------------------------------------------------------

/**
 * Main client for the IVXP protocol.
 *
 * Extends EventEmitter<SDKEventMap> to provide type-safe event emission
 * for SDK lifecycle events (catalog.received, order.quoted, order.paid, etc.).
 *
 * Provides access to cryptographic signing, USDC payments, HTTP
 * communication, and service catalog fetching. Services are created
 * internally by default but can be overridden via dependency injection
 * for testing.
 *
 * @example
 * ```typescript
 * const client = createIVXPClient({ privateKey: "0x..." });
 * client.on('order.paid', ({ orderId, txHash }) => console.log(orderId, txHash));
 * const catalog = await client.getCatalog("http://provider.example.com");
 * ```
 */
export class IVXPClient extends EventEmitter<SDKEventMap> {
  private readonly cryptoService: ICryptoService;
  private readonly paymentService: IPaymentService;
  private readonly httpClient: IHttpClient;
  private readonly network: NetworkType;
  private readonly callbackServerOptions?: CallbackServerOptions;
  private callbackServerInstance?: CallbackServerResult;

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
    super();

    const { privateKey, network = "base-sepolia" } = config;

    if (!privateKey || !PRIVATE_KEY_REGEX.test(privateKey)) {
      throw new Error(
        "Invalid private key: must be a 0x-prefixed 64-character hex string (32 bytes)",
      );
    }

    this.network = network;
    this.callbackServerOptions = config.callbackServer;

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
  // Callback Server (Push Delivery Reception)
  // -------------------------------------------------------------------------

  /**
   * Start the callback server for receiving push deliveries.
   *
   * Creates an HTTP server that listens for push deliveries at
   * POST /ivxp/callback. The server validates content hashes and
   * emits 'delivery.received' or 'delivery.rejected' events.
   *
   * If callback server options were provided in the client config,
   * those are used. Otherwise, default options (port 0, host 127.0.0.1)
   * are applied.
   *
   * @param options - Optional override for callback server options
   * @returns The callback server result with URL, port, and stop function
   * @throws IVXPError if the callback server is already running
   */
  async startCallbackServer(options?: CallbackServerOptions): Promise<CallbackServerResult> {
    if (this.callbackServerInstance) {
      throw new IVXPError("Callback server is already running", "CALLBACK_SERVER_ALREADY_RUNNING");
    }

    const serverOptions = options ?? this.callbackServerOptions ?? {};

    const onDelivery = (payload: unknown): void => {
      const p = payload as {
        readonly order_id: string;
        readonly deliverable: {
          readonly content_hash: string;
          readonly format: string;
        };
      };
      this.emit("delivery.received", {
        orderId: p.order_id,
        contentHash: p.deliverable.content_hash,
        format: p.deliverable.format,
      });
    };

    const onRejected = (details: RejectionDetails, payload: unknown): void => {
      const p = payload as {
        readonly order_id: string;
      };

      this.emit("delivery.rejected", {
        orderId: p.order_id,
        reason: details.reason,
        expectedHash: details.expectedHash,
        computedHash: details.computedHash,
      });
    };

    const result = await createCallbackServer(onDelivery, onRejected, serverOptions);
    this.callbackServerInstance = result;
    return result;
  }

  /**
   * Stop the callback server gracefully.
   *
   * Stops accepting new connections and drains pending deliveries
   * before closing. Safe to call if the server is not running.
   */
  async stopCallbackServer(): Promise<void> {
    if (!this.callbackServerInstance) {
      return;
    }

    await this.callbackServerInstance.stop();
    this.callbackServerInstance = undefined;
  }

  /**
   * Get the callback URL for push delivery.
   *
   * Returns the full URL of the callback server endpoint, suitable
   * for inclusion in service requests as the `delivery_endpoint`.
   *
   * @returns The callback URL, or undefined if the server is not running
   */
  getCallbackUrl(): string | undefined {
    return this.callbackServerInstance?.url;
  }

  /**
   * Check if the callback server is currently running.
   *
   * @returns true if the callback server is active
   */
  isCallbackServerRunning(): boolean {
    return this.callbackServerInstance !== undefined;
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
    let streamUrl: string | undefined;
    try {
      const rawResponse = await this.httpClient.post<unknown>(
        paymentUrl,
        paymentProof as unknown as JsonSerializable,
      );
      // Attempt to parse stream_url from the payment acceptance response
      const parsed = DeliveryAcceptedSchema.safeParse(rawResponse);
      if (parsed.success) {
        streamUrl = parsed.data.streamUrl;
      }
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
      streamUrl,
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

    // Track previous status for change detection using a closure-scoped
    // context object that is replaced (not mutated) at each status transition.
    // This avoids direct variable mutation while retaining the sequential
    // single-threaded async flow behavior required for event ordering.
    type PollContext = { readonly previousStatus: string | null };
    let ctx: PollContext = { previousStatus: null };

    return pollWithBackoff(
      async () => {
        const orderStatus = await this.getOrderStatus(providerUrl, orderId);

        // Emit status change event if status differs from previous
        if (orderStatus.status !== ctx.previousStatus) {
          this.emit("order.status_changed", {
            orderId: orderStatus.orderId,
            previousStatus: ctx.previousStatus,
            newStatus: orderStatus.status,
          });
          ctx = { previousStatus: orderStatus.status };
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
  // SSE Streaming
  // -------------------------------------------------------------------------

  /**
   * Subscribe to a real-time SSE stream for order events.
   *
   * Connects to the given `streamUrl` and dispatches typed events to handlers.
   * Returns an unsubscribe function. Throws `SSEExhaustedError` after
   * `maxRetries` failed connection attempts.
   *
   * @param streamUrl - The SSE stream URL (from DeliveryAccepted response)
   * @param handlers - Event handlers for status_update, progress, completed, failed
   * @returns Promise resolving to an unsubscribe function
   * @throws SSEExhaustedError if all retry attempts fail
   */
  async subscribeToStream(
    streamUrl: string,
    handlers: SSEHandlers,
    options: SSEConnectOptions = {},
  ): Promise<() => void> {
    const sseClient = new SSEClient();
    return sseClient.connect(streamUrl, handlers, options);
  }

  // -------------------------------------------------------------------------
  // Download Deliverable
  // -------------------------------------------------------------------------

  /**
   * Download a completed deliverable from a provider.
   *
   * Makes a GET request to `{providerUrl}/ivxp/orders/{orderId}/deliverable`,
   * validates the response against the DeliveryResponse Zod schema (which
   * transforms wire-format snake_case to camelCase), and emits an
   * 'order.delivered' event on success.
   *
   * Supports multiple deliverable formats (JSON, markdown, code, binary).
   * The response is validated as a complete DeliveryResponse message per
   * the IVXP/1.0 wire protocol.
   *
   * If `options.savePath` is provided, the deliverable content will be
   * written to the specified file path (requires Node.js runtime).
   *
   * @param providerUrl - Base URL of the provider (e.g. "http://provider.example.com")
   * @param orderId - The order identifier for the deliverable to download
   * @param options - Optional download configuration (savePath)
   * @returns Validated and typed DeliveryResponseOutput with camelCase fields
   * @throws IVXPError with code INVALID_PROVIDER_URL if providerUrl is not a valid HTTP(S) URL
   * @throws IVXPError with code INVALID_REQUEST_PARAMS if orderId is invalid
   * @throws IVXPError with code INVALID_DELIVERABLE_FORMAT if response fails Zod validation
   * @throws ServiceUnavailableError if the provider is unreachable or returns a network error
   */
  async downloadDeliverable(
    providerUrl: string,
    orderId: string,
    options: DownloadOptions = {},
  ): Promise<DeliveryResponseOutput> {
    validateOrderId(orderId);
    const normalizedUrl = validateProviderUrl(providerUrl);
    const deliverableUrl = `${normalizedUrl}/ivxp/orders/${encodeURIComponent(orderId)}/deliverable`;

    try {
      const rawResponse = await this.httpClient.get<unknown>(deliverableUrl);

      // Validate and transform wire-format JSON using Zod schema
      const deliveryResponse = DeliveryResponseSchema.parse(rawResponse);

      // Verify response orderId matches the requested orderId (security check).
      // A malicious or misconfigured provider could return a different order's
      // deliverable, which would be a data integrity violation.
      if (deliveryResponse.orderId !== orderId) {
        throw new IVXPError(
          `Order ID mismatch: requested "${orderId}" but received "${deliveryResponse.orderId}"`,
          "ORDER_ID_MISMATCH",
          { requestedOrderId: orderId, receivedOrderId: deliveryResponse.orderId },
        );
      }

      // Save to file if path provided
      if (options.savePath) {
        await this.saveDeliverable(deliveryResponse, options.savePath);
      }

      // Emit event on successful download
      this.emit("order.delivered", {
        orderId: deliveryResponse.orderId,
        format: deliveryResponse.deliverable.format ?? "unknown",
      });

      return deliveryResponse;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new IVXPError(
          `Invalid deliverable format from ${normalizedUrl}: ${error.issues.length} validation issue(s)`,
          "INVALID_DELIVERABLE_FORMAT",
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
        `Failed to download deliverable from ${normalizedUrl}: ${errorMessage}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Confirm Delivery
  // -------------------------------------------------------------------------

  /**
   * Confirm delivery and finalize the order.
   *
   * Creates an EIP-191 signed confirmation message and sends it to the
   * provider's confirmation endpoint at `/ivxp/orders/{orderId}/confirm`.
   * On success, the order transitions to the terminal 'confirmed' state.
   *
   * If the provider reports the order is already confirmed
   * (ORDER_ALREADY_CONFIRMED), the method returns success rather than
   * throwing -- idempotent confirmation is by design. In this case,
   * `confirmedAt` will be the local timestamp of this call rather than
   * the original confirmation timestamp from the provider, since the
   * error response does not carry the original timestamp. Use
   * `getOrderStatus()` if you need the authoritative confirmation time.
   *
   * Emits 'order.confirmed' event on successful confirmation.
   *
   * @param providerUrl - Base URL of the provider (e.g. "http://provider.example.com")
   * @param orderId - The order identifier to confirm
   * @returns ConfirmationResult with orderId, status, confirmedAt, and signature
   * @throws IVXPError with code INVALID_PROVIDER_URL if providerUrl is not a valid HTTP(S) URL
   * @throws IVXPError with code INVALID_REQUEST_PARAMS if orderId is invalid
   * @throws IVXPError with code ORDER_NOT_DELIVERED if the order is not in 'delivered' state
   * @throws ServiceUnavailableError if the provider is unreachable or returns a network error
   */
  async confirmDelivery(providerUrl: string, orderId: string): Promise<ConfirmationResult> {
    // 1. Validate inputs (fail fast before any side effects)
    validateOrderId(orderId);
    const normalizedUrl = validateProviderUrl(providerUrl);
    const confirmUrl = `${normalizedUrl}/ivxp/orders/${encodeURIComponent(orderId)}/confirm`;

    // 2. Build and sign confirmation message
    const timestamp = new Date().toISOString();
    const confirmationMessage = `Confirm delivery: ${orderId} | Timestamp: ${timestamp}`;
    const signature = await this.cryptoService.sign(confirmationMessage);
    const walletAddress = await this.getAddress();

    // 3. Build wire-format confirmation
    const confirmation: WireFormatDeliveryConfirmationMessage = {
      protocol: PROTOCOL_VERSION,
      message_type: "delivery_confirmation",
      timestamp,
      order_id: orderId,
      confirmation: {
        message: confirmationMessage,
        signature,
        signer: walletAddress,
      },
    };

    // 4. Send confirmation to provider
    try {
      const rawResponse = await this.httpClient.post<unknown>(
        confirmUrl,
        confirmation as unknown as JsonSerializable,
      );

      // 5. Validate provider response
      const response = ConfirmationResponseSchema.parse(rawResponse);

      // 6. Emit 'order.confirmed' event
      this.emit("order.confirmed", {
        orderId,
        confirmedAt: response.confirmed_at,
      });

      // 7. Return confirmation result
      return {
        orderId,
        status: "confirmed" as const,
        confirmedAt: response.confirmed_at,
        signature,
      };
    } catch (error) {
      // Already confirmed is idempotent -- return success
      if (error instanceof IVXPError && error.code === "ORDER_ALREADY_CONFIRMED") {
        return {
          orderId,
          status: "confirmed" as const,
          confirmedAt: timestamp,
          signature,
        };
      }

      if (error instanceof z.ZodError) {
        throw new IVXPError(
          `Invalid confirmation response from ${normalizedUrl}: ${error.issues.length} validation issue(s)`,
          "INVALID_CONFIRMATION_FORMAT",
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
        `Failed to confirm delivery at ${normalizedUrl}: ${errorMessage}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Request Service (one-line convenience method)
  // -------------------------------------------------------------------------

  /**
   * Complete service request flow in one call.
   *
   * Orchestrates: quote -> pay -> poll -> download -> confirm.
   *
   * Budget guard: If the quote price exceeds `budgetUsdc`, throws
   * `BudgetExceededError` before any on-chain transaction is initiated.
   *
   * Timeout guard: If the entire flow exceeds `timeoutMs`, throws
   * `TimeoutError` with partial state (e.g. txHash if payment succeeded).
   *
   * Provider errors: If the provider is unreachable or returns an error,
   * throws `ProviderError` with step context (which stage failed).
   *
   * @param params - Service request parameters including budget, timeout, callbacks
   * @returns Complete result with deliverable, quote, payment hash, and confirmation
   * @throws BudgetExceededError if quote price exceeds budgetUsdc
   * @throws TimeoutError if the flow exceeds timeoutMs
   * @throws ProviderError if the provider is unreachable or returns an error
   * @throws IVXPError if delivery fails
   */
  async requestService(params: RequestServiceParams): Promise<RequestServiceResult> {
    const {
      providerUrl,
      serviceType,
      description,
      budgetUsdc,
      deliveryFormat,
      timeoutMs = 120_000,
      autoConfirm = true,
      pollOptions,
      onQuote,
      onPayment,
      onDelivered,
      onConfirmed,
    } = params;

    // FlowState tracks progression through the multi-step requestService
    // pipeline. The `state` variable is reassigned (not mutated) at each
    // step transition using spread syntax to create new immutable snapshots.
    // This is local variable reassignment within a single-threaded async
    // flow -- it does not violate the immutability principle, which applies
    // to shared/external state and object mutation.
    type FlowState = {
      readonly step: string;
      readonly paymentTxHash?: `0x${string}`;
    };
    let state: FlowState = { step: "quote" };

    // Set up timeout via AbortController
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

    try {
      // Step 1: Request quote
      state = { ...state, step: "quote" };
      const quote = await this.requestQuote(providerUrl, {
        serviceType,
        description,
        budgetUsdc,
        deliveryFormat,
      });

      // Budget guard: use integer micro-USDC comparison to avoid
      // IEEE 754 floating-point precision issues.
      const quoteCents = Math.round(quote.quote.priceUsdc * 1_000_000);
      const budgetCents = Math.round(budgetUsdc * 1_000_000);
      if (quoteCents > budgetCents) {
        throw new BudgetExceededError(
          `Quote price ${quote.quote.priceUsdc} USDC exceeds budget ${budgetUsdc} USDC`,
          { orderId: quote.orderId, priceUsdc: quote.quote.priceUsdc },
          budgetUsdc,
        );
      }

      onQuote?.(quote);

      // Check timeout after each step
      this.checkAborted(abortController, timeoutMs, state);

      // Step 2: Submit payment
      state = { ...state, step: "payment" };
      const paymentResult = await this.submitPayment(providerUrl, quote.orderId, {
        priceUsdc: quote.quote.priceUsdc,
        paymentAddress: quote.quote.paymentAddress as `0x${string}`,
      });
      state = { ...state, paymentTxHash: paymentResult.txHash };

      onPayment?.(paymentResult);

      this.checkAborted(abortController, timeoutMs, state);

      // Step 3: Wait for delivery (SSE if stream_url available, else poll)
      state = { ...state, step: "poll" };
      let deliveredOrder: OrderStatusResponseOutput;
      if (paymentResult.streamUrl) {
        try {
          deliveredOrder = await this.waitViaSSE(
            paymentResult.streamUrl,
            quote.orderId,
            providerUrl,
            { ...pollOptions, signal: abortController.signal },
          );
        } catch (err) {
          if (err instanceof SSEExhaustedError) {
            this.emit("sse_fallback", { orderId: quote.orderId, reason: err.message });
            // Fall through to polling
            deliveredOrder = await this.waitForDelivery(providerUrl, quote.orderId, {
              ...pollOptions,
              signal: abortController.signal,
            });
          } else {
            throw err;
          }
        }
      } else {
        deliveredOrder = await this.waitForDelivery(providerUrl, quote.orderId, {
          ...pollOptions,
          signal: abortController.signal,
        });
      }

      if (deliveredOrder.status === "delivery_failed") {
        throw new IVXPError(`Delivery failed for order ${quote.orderId}`, "DELIVERY_FAILED", {
          orderId: quote.orderId,
        });
      }

      this.checkAborted(abortController, timeoutMs, state);

      // Step 4: Download deliverable
      state = { ...state, step: "download" };
      const deliverable = await this.downloadDeliverable(providerUrl, quote.orderId);

      onDelivered?.(deliverable);

      this.checkAborted(abortController, timeoutMs, state);

      // Step 5: Confirm delivery (if auto-confirm enabled)
      let confirmedAt: string | undefined;
      if (autoConfirm) {
        state = { ...state, step: "confirm" };
        const confirmResult = await this.confirmDelivery(providerUrl, quote.orderId);
        confirmedAt = confirmResult.confirmedAt;
        onConfirmed?.(confirmResult);
      }

      // paymentTxHash is guaranteed to be set at this point: step 2
      // (submitPayment) succeeded without throwing, and the state was
      // updated with the txHash immediately after. Any failure in steps
      // 2-5 would have thrown, preventing execution from reaching here.
      // The non-null assertion is safe due to this control flow guarantee.

      return {
        orderId: quote.orderId,
        status: autoConfirm ? "confirmed" : "delivered",
        deliverable,
        quote,
        paymentTxHash: state.paymentTxHash as `0x${string}`,
        confirmedAt,
      };
    } catch (error) {
      // If aborted, throw TimeoutError with partial state
      if (abortController.signal.aborted) {
        throw new TimeoutError(
          `requestService timed out after ${timeoutMs}ms at step: ${state.step}`,
          state.step,
          state.paymentTxHash ? { txHash: state.paymentTxHash } : {},
          error instanceof Error ? error : undefined,
        );
      }

      // Wrap ServiceUnavailableError as ProviderError with step context
      if (error instanceof ServiceUnavailableError) {
        throw new ProviderError(
          `Provider error at step "${state.step}": ${error.message}`,
          providerUrl,
          state.step,
          error,
        );
      }

      // Re-throw known IVXP errors (BudgetExceededError, etc.)
      if (error instanceof IVXPError) {
        throw error;
      }

      // Wrap unknown errors as ProviderError with step context
      throw new ProviderError(
        `Provider error at step "${state.step}": ${(error as Error).message}`,
        providerUrl,
        state.step,
        error instanceof Error ? error : undefined,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Wait for order delivery via SSE stream.
   *
   * Connects to the SSE stream and resolves when a 'completed' or 'failed'
   * event is received. Falls back to polling if SSE is exhausted.
   *
   * @throws SSEExhaustedError if all SSE retry attempts fail (caller falls back to polling)
   */
  private async waitViaSSE(
    streamUrl: string,
    orderId: string,
    providerUrl: string,
    pollOptions: Omit<OrderPollOptions, "targetStatuses">,
  ): Promise<OrderStatusResponseOutput> {
    return new Promise<OrderStatusResponseOutput>((resolve, reject) => {
      let settled = false;
      let unsubscribe: (() => void) | undefined;

      const cleanup = (): void => {
        pollOptions.signal?.removeEventListener("abort", onAbort);
        unsubscribe?.();
      };

      const settleResolve = (status: OrderStatusResponseOutput): void => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(status);
      };

      const settleReject = (error: unknown): void => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };

      const resolveWithFinalStatus = (): void => {
        this.getOrderStatus(providerUrl, orderId).then(settleResolve).catch(settleReject);
      };

      const onAbort = (): void => {
        settleReject(new Error("Aborted"));
      };

      if (pollOptions.signal?.aborted) {
        settleReject(new Error("Aborted"));
        return;
      }

      pollOptions.signal?.addEventListener("abort", onAbort, { once: true });

      this.subscribeToStream(
        streamUrl,
        {
          onCompleted: resolveWithFinalStatus,
          onFailed: resolveWithFinalStatus,
          onExhausted: (error) => {
            settleReject(error);
          },
        },
        { signal: pollOptions.signal },
      )
        .then((unsub) => {
          if (settled) {
            unsub();
            return;
          }
          unsubscribe = unsub;
        })
        .catch(settleReject);
    });
  }

  /**
   * Check if the abort signal has fired and throw TimeoutError if so.
   *
   * Called between steps in `requestService` to detect timeouts early
   * rather than waiting for the next async operation to check the signal.
   */
  private checkAborted(
    controller: AbortController,
    timeoutMs: number,
    state: { readonly step: string; readonly paymentTxHash?: `0x${string}` },
  ): void {
    if (controller.signal.aborted) {
      throw new TimeoutError(
        `requestService timed out after ${timeoutMs}ms at step: ${state.step}`,
        state.step,
        state.paymentTxHash ? { txHash: state.paymentTxHash } : {},
      );
    }
  }

  /**
   * Save deliverable content to a file.
   *
   * Writes the deliverable content to the specified file path.
   * Requires Node.js runtime with `fs/promises` module available.
   *
   * Uses dynamic import so this module remains usable in browser
   * environments where `fs/promises` is not available (the method
   * simply won't be called in browser contexts).
   *
   * @param deliveryResponse - The validated delivery response
   * @param filePath - The file path to write the content to
   */
  private async saveDeliverable(
    deliveryResponse: DeliveryResponseOutput,
    filePath: string,
  ): Promise<void> {
    // Dynamic import to keep the SDK browser-compatible.
    // Type assertion needed because @types/node is not a dependency.
    const fsModule = "fs/promises";
    const fs = (await import(/* @vite-ignore */ fsModule)) as {
      writeFile: (path: string, data: string, encoding: string) => Promise<void>;
    };
    const content = deliveryResponse.deliverable.content;

    if (typeof content === "string") {
      await fs.writeFile(filePath, content, "utf-8");
    } else {
      // For objects/arrays, serialize to JSON with indentation
      await fs.writeFile(filePath, JSON.stringify(content, null, 2), "utf-8");
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
