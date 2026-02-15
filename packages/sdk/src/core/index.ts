/**
 * Core module exports.
 *
 * Provides the main IVXPClient class, IVXPProvider class, factory functions,
 * EventEmitter, and SDK-specific types for interacting with the IVXP protocol.
 *
 * Key exports:
 * - {@link IVXPClient} - Main client class for all IVXP operations
 * - {@link createIVXPClient} - Factory function with input validation
 * - {@link IVXPProvider} - Main provider class for hosting IVXP services
 * - {@link createIVXPProvider} - Factory function for provider construction
 * - {@link EventEmitter} - Lightweight, type-safe event emitter
 * - {@link IVXPClientConfig} - Configuration for client construction
 * - {@link IVXPProviderConfig} - Configuration for provider construction
 * - {@link ServiceRequestParams} - Parameters for requesting a service quote
 * - {@link SubmitPaymentQuote} - Quote details for payment submission
 * - {@link PaymentResult} - Result of a successful payment
 * - {@link DownloadOptions} - Options for downloading deliverables
 * - {@link ConfirmationResult} - Result of a successful delivery confirmation
 * - {@link OrderPollOptions} - Configuration for order status polling
 * - {@link createCallbackServer} - Factory for push delivery callback server
 * - {@link CallbackServerOptions} - Configuration for the callback server
 * - {@link CallbackServerResult} - Result of creating a callback server
 */

/** Main IVXP client class and factory. */
export {
  IVXPClient,
  createIVXPClient,
  type IVXPClientConfig,
  type OrderPollOptions,
} from "./client.js";

/** Main IVXP provider class and factory. */
export {
  IVXPProvider,
  createIVXPProvider,
  type IVXPProviderConfig,
  type ProviderStartResult,
  type ServiceHandler,
} from "./provider.js";

/** Default in-memory order storage implementation. */
export { InMemoryOrderStore } from "./in-memory-order-store.js";

/** Callback server for push delivery reception. */
export {
  createCallbackServer,
  type CallbackServerOptions,
  type CallbackServerResult,
  type RejectionDetails,
} from "./callback-server.js";

/** Lightweight, type-safe event emitter and SDK event types. */
export { EventEmitter } from "./events.js";
export type { SDKEvent, SDKEventMap, SDKEventName, SDKEventPayload } from "./events.js";

/** SDK-specific parameter and result types. */
export type {
  ServiceRequestParams,
  SubmitPaymentQuote,
  PaymentResult,
  DownloadOptions,
  ConfirmationResult,
  RequestServiceParams,
  RequestServiceResult,
} from "./types.js";
