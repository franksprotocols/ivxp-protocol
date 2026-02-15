/**
 * Core module exports.
 *
 * Provides the main IVXPClient class and factory function for the IVXP SDK.
 */
export {
  IVXPClient,
  createIVXPClient,
  type IVXPClientConfig,
  type OrderPollOptions,
} from "./client.js";

export type { ServiceRequestParams, SubmitPaymentQuote, PaymentResult } from "./types.js";
