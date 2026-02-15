/**
 * Error module exports.
 *
 * Provides all IVXP SDK error classes and error code constants
 * for use throughout the SDK.
 */

export { IVXPError } from "./base.js";
export {
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
  type BudgetExceededQuoteInfo,
} from "./specific.js";

/**
 * Error code constants for programmatic error handling.
 *
 * Each code is SCREAMING_SNAKE_CASE and maps to exactly one
 * error class in the hierarchy.
 */
export const ERROR_CODES = {
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
  TRANSACTION_FAILED: "TRANSACTION_FAILED",
  TRANSACTION_SUBMISSION_FAILED: "TRANSACTION_SUBMISSION_FAILED",
  PAYMENT_NOT_FOUND: "PAYMENT_NOT_FOUND",
  PAYMENT_PENDING: "PAYMENT_PENDING",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  PAYMENT_AMOUNT_MISMATCH: "PAYMENT_AMOUNT_MISMATCH",
  SIGNATURE_INVALID: "SIGNATURE_INVALID",
  PAYMENT_NOT_VERIFIED: "PAYMENT_NOT_VERIFIED",
  ORDER_NOT_FOUND: "ORDER_NOT_FOUND",
  ORDER_EXPIRED: "ORDER_EXPIRED",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  MAX_POLL_ATTEMPTS: "MAX_POLL_ATTEMPTS",
  PARTIAL_SUCCESS: "PARTIAL_SUCCESS",
  BUDGET_EXCEEDED: "BUDGET_EXCEEDED",
  TIMEOUT: "TIMEOUT",
  PROVIDER_ERROR: "PROVIDER_ERROR",
} as const;
