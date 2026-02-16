/**
 * Core module exports.
 *
 * Provides the main IVXPClient class, factory function, and SDK-specific
 * types for interacting with the IVXP protocol.
 *
 * Key exports:
 * - {@link IVXPClient} - Main client class for all IVXP operations
 * - {@link createIVXPClient} - Factory function with input validation
 * - {@link IVXPClientConfig} - Configuration for client construction
 * - {@link ServiceRequestParams} - Parameters for requesting a service quote
 * - {@link SubmitPaymentQuote} - Quote details for payment submission
 * - {@link PaymentResult} - Result of a successful payment
 * - {@link DownloadOptions} - Options for downloading deliverables
 * - {@link ConfirmationResult} - Result of a successful delivery confirmation
 * - {@link OrderPollOptions} - Configuration for order status polling
 */

/** Main IVXP client class and factory. */
export {
  IVXPClient,
  createIVXPClient,
  type IVXPClientConfig,
  type OrderPollOptions,
} from "./client.js";

/** SDK-specific parameter and result types. */
export type {
  ServiceRequestParams,
  SubmitPaymentQuote,
  PaymentResult,
  DownloadOptions,
  ConfirmationResult,
} from "./types.js";
