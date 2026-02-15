/**
 * @ivxp/sdk
 *
 * Client library for the Intelligence Value Exchange Protocol.
 */

// Crypto module
export {
  CryptoService,
  createCryptoService,
  formatIVXPMessage,
  type IVXPMessageParams,
  type IVXPSignedMessage,
  type IVXPVerifyParams,
  type IVXPVerificationResult,
} from "./crypto/index.js";

// Payment module
export {
  PaymentService,
  createPaymentService,
  type NetworkType,
  type PaymentServiceConfig,
  type PaymentClientOverrides,
} from "./payment/index.js";

// HTTP module
export { HttpClient, createHttpClient, type HttpClientOptions } from "./http/index.js";

// Polling module
export { pollWithBackoff, pollOrderStatus, type PollOptions } from "./polling/index.js";

// Core module
export { IVXPClient, createIVXPClient, type IVXPClientConfig } from "./core/index.js";

// Errors
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
  ERROR_CODES,
} from "./errors/index.js";
