/**
 * @ivxp/sdk
 *
 * Client library for the Intelligence Value Exchange Protocol.
 *
 * @example
 * ```typescript
 * // One-line convenience method (most common)
 * import { createIVXPClient } from '@ivxp/sdk';
 *
 * const client = createIVXPClient({
 *   privateKey: '0x...',
 *   network: 'base-sepolia',
 * });
 *
 * const result = await client.requestService({
 *   providerUrl: 'https://provider.example.com',
 *   serviceType: 'market-analysis',
 *   description: 'Analyze USDC/ETH trading pair',
 *   budgetUsdc: 10,
 * });
 *
 * console.log(result.deliverable);
 * ```
 *
 * @example
 * ```typescript
 * // Subpath imports for advanced usage
 * import { CryptoService, createCryptoService } from '@ivxp/sdk/crypto';
 * import { PaymentService } from '@ivxp/sdk/payment';
 * import { IVXPClient } from '@ivxp/sdk/core';
 * import { IVXPError } from '@ivxp/sdk/errors';
 *
 * // Type-only imports (zero runtime cost)
 * import type { RequestServiceParams, SDKEventMap } from '@ivxp/sdk';
 * ```
 */

// ---------------------------------------------------------------------------
// Core module (most common usage)
// ---------------------------------------------------------------------------

export {
  IVXPClient,
  createIVXPClient,
  IVXPProvider,
  createIVXPProvider,
  InMemoryOrderStore,
  InMemoryDeliverableStore,
  computeContentHash,
  createCallbackServer,
  EventEmitter,
  type IVXPClientConfig,
  type IVXPProviderConfig,
  type ProviderStartResult,
  type OrderPollOptions,
  type CallbackServerOptions,
  type CallbackServerResult,
  type RejectionDetails,
  type IDeliverableStore,
  type StoredDeliverable,
  type ServiceRequestParams,
  type SubmitPaymentQuote,
  type PaymentResult,
  type DownloadOptions,
  type ConfirmationResult,
  type RequestServiceParams,
  type RequestServiceResult,
  type SDKEvent,
  type SDKEventMap,
  type SDKEventName,
  type SDKEventPayload,
  hasCapability,
  CAPABILITY_SSE,
  type KnownCapability,
} from "./core/index.js";

// ---------------------------------------------------------------------------
// Crypto module
// ---------------------------------------------------------------------------

export {
  CryptoService,
  createCryptoService,
  formatIVXPMessage,
  type IVXPMessageParams,
  type IVXPSignedMessage,
  type IVXPVerifyParams,
  type IVXPVerificationResult,
} from "./crypto/index.js";

// ---------------------------------------------------------------------------
// Payment module
// ---------------------------------------------------------------------------

export {
  PaymentService,
  createPaymentService,
  type NetworkType,
  type PaymentServiceConfig,
  type PaymentClientOverrides,
} from "./payment/index.js";

// ---------------------------------------------------------------------------
// HTTP module
// ---------------------------------------------------------------------------

export { HttpClient, createHttpClient, type HttpClientOptions } from "./http/index.js";

// ---------------------------------------------------------------------------
// Polling module
// ---------------------------------------------------------------------------

export { pollWithBackoff, pollOrderStatus, type PollOptions } from "./polling/index.js";

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export {
  IVXPError,
  InsufficientBalanceError,
  TransactionError,
  TransactionSubmissionError,
  PaymentNotFoundError,
  PaymentPendingError,
  PaymentFailedError,
  PaymentAmountMismatchError,
  SignatureVerificationError,
  PaymentVerificationError,
  OrderNotFoundError,
  OrderExpiredError,
  ServiceUnavailableError,
  MaxPollAttemptsError,
  PartialSuccessError,
  BudgetExceededError,
  TimeoutError,
  ProviderError,
  ERROR_CODES,
  type BudgetExceededQuoteInfo,
} from "./errors/index.js";

// ---------------------------------------------------------------------------
// Protocol re-exports (convenience for SDK users)
//
// Value exports: Runtime constants needed by consumers to configure the SDK
// or perform protocol-level checks (e.g. compare order statuses, reference
// contract addresses).
//
// Type exports: TypeScript interfaces only -- erased at runtime. These
// give consumers access to protocol type definitions without requiring a
// direct dependency on @ivxp/protocol.
// ---------------------------------------------------------------------------

/** Runtime constants from the protocol package. */
export {
  PROTOCOL_VERSION,
  ORDER_STATUSES,
  USDC_CONTRACT_ADDRESSES,
  USDC_DECIMALS,
} from "@ivxp/protocol";

/** Protocol type definitions (erased at runtime, zero bundle cost). */
export type {
  ServiceCatalog,
  ServiceQuote,
  OrderStatus,
  Deliverable,
  DeliveryFormat,
  ServiceCatalogOutput,
  ServiceQuoteOutput,
  OrderStatusResponseOutput,
  DeliveryResponseOutput,
} from "@ivxp/protocol";

// ---------------------------------------------------------------------------
// Adapter interfaces (type-only, zero runtime cost)
// ---------------------------------------------------------------------------

/**
 * Framework adapter interfaces for IVXP client and provider implementations.
 *
 * These interfaces define the contract for integrating IVXP into different
 * frameworks (Express, Fastify, Next.js, Hono, etc.).
 */
export type { IVXPClientAdapter, IVXPProviderAdapter } from "./adapters/index.js";

// ---------------------------------------------------------------------------
// SSE module
// ---------------------------------------------------------------------------

/**
 * Server-Sent Events client for real-time order streaming.
 *
 * Use `SSEClient` directly for advanced SSE usage, or use
 * `IVXPClient.subscribeToStream()` for the integrated experience.
 */
export { SSEClient, SSEExhaustedError } from "./sse/index.js";
export type { SSEEvent, SSEHandlers, SSEClientOptions, SSEConnectOptions } from "./sse/index.js";
