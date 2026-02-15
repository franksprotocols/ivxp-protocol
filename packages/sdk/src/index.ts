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
} from "./errors/index.js";
