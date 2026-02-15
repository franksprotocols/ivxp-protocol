/**
 * Specific IVXP SDK error classes.
 *
 * Each error class extends IVXPError with a predefined code
 * and domain-specific context fields. Error classes are organized
 * by domain: payment, verification, order, network, polling, and
 * recovery (partial success).
 */

import { IVXPError } from "./base.js";

// ---------------------------------------------------------------------------
// Validation Helpers
// ---------------------------------------------------------------------------

/**
 * Validate that a string is a well-formed hex transaction hash.
 *
 * A valid tx hash is exactly 66 characters: "0x" followed by 64
 * hexadecimal digits (32 bytes).
 *
 * @param txHash - The string to validate
 * @throws IVXPError if the hash is malformed
 */
function assertValidTxHash(txHash: string): void {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    throw new IVXPError(
      `Invalid transaction hash: expected 0x-prefixed 64-character hex string, got "${txHash}"`,
      "INVALID_TX_HASH",
      { txHash },
    );
  }
}

/**
 * Validate that a balance string is a non-empty numeric representation.
 *
 * Accepts integer or decimal strings (e.g. "10", "10.00", "0.5").
 * Rejects empty, whitespace-only, or non-numeric strings.
 *
 * @param value - The string to validate
 * @param label - Human-readable label for the error message
 * @throws IVXPError if the value is not a valid numeric string
 */
function assertNumericString(value: string, label: string): void {
  if (!/^\d+(\.\d+)?$/.test(value)) {
    throw new IVXPError(
      `Invalid ${label}: expected numeric string, got "${value}"`,
      "INVALID_NUMERIC_STRING",
      { value, label },
    );
  }
}

// ---------------------------------------------------------------------------
// Payment Errors
// ---------------------------------------------------------------------------

/**
 * Thrown when a USDC transfer fails due to insufficient balance.
 *
 * Provides the available balance and the required amount for
 * diagnostic purposes. Both values are validated as numeric strings
 * at construction time.
 */
export class InsufficientBalanceError extends IVXPError {
  constructor(
    message: string,
    public readonly availableBalance: string,
    public readonly requiredAmount: string,
    cause?: unknown,
  ) {
    assertNumericString(availableBalance, "availableBalance");
    assertNumericString(requiredAmount, "requiredAmount");
    super(message, "INSUFFICIENT_BALANCE", { availableBalance, requiredAmount }, cause);
    this.name = "InsufficientBalanceError";
  }
}

/**
 * Thrown when a confirmed blockchain transaction fails or reverts.
 *
 * The txHash is required because this error represents a transaction
 * that was submitted and received a receipt, but the receipt shows
 * failure. The hash is validated at construction time.
 */
export class TransactionError extends IVXPError {
  constructor(
    message: string,
    public readonly txHash: `0x${string}`,
    cause?: unknown,
  ) {
    assertValidTxHash(txHash);
    super(message, "TRANSACTION_FAILED", { txHash }, cause);
    this.name = "TransactionError";
  }
}

/**
 * Thrown when a blockchain transaction cannot be submitted to the
 * network.
 *
 * No txHash is available because the transaction was rejected before
 * being included in a block (e.g. RPC failure, nonce error, gas
 * estimation failure).
 */
export class TransactionSubmissionError extends IVXPError {
  constructor(message: string, cause?: unknown) {
    super(message, "TRANSACTION_SUBMISSION_FAILED", undefined, cause);
    this.name = "TransactionSubmissionError";
  }
}

// ---------------------------------------------------------------------------
// Payment Verification Errors
// ---------------------------------------------------------------------------

/**
 * Thrown when a transaction hash cannot be found on-chain.
 *
 * This means the transaction does not exist -- it was never submitted
 * or is not yet visible to the node.
 */
export class PaymentNotFoundError extends IVXPError {
  constructor(message: string, cause?: unknown) {
    super(message, "PAYMENT_NOT_FOUND", undefined, cause);
    this.name = "PaymentNotFoundError";
  }
}

/**
 * Thrown when a transaction exists but has not yet been included in
 * a block.
 *
 * The caller should wait and retry verification later.
 */
export class PaymentPendingError extends IVXPError {
  constructor(message: string, cause?: unknown) {
    super(message, "PAYMENT_PENDING", undefined, cause);
    this.name = "PaymentPendingError";
  }
}

/**
 * Thrown when a transaction was confirmed but reverted on-chain.
 *
 * The txHash is included for diagnostic purposes and validated at
 * construction time.
 */
export class PaymentFailedError extends IVXPError {
  constructor(
    message: string,
    public readonly txHash: `0x${string}`,
    cause?: unknown,
  ) {
    assertValidTxHash(txHash);
    super(message, "PAYMENT_FAILED", { txHash }, cause);
    this.name = "PaymentFailedError";
  }
}

/**
 * Thrown when the on-chain transfer amount does not match the
 * expected amount.
 *
 * Provides both expected and actual amounts for diagnostic purposes.
 */
export class PaymentAmountMismatchError extends IVXPError {
  constructor(
    message: string,
    public readonly expectedAmount: string,
    public readonly actualAmount: string,
    cause?: unknown,
  ) {
    super(message, "PAYMENT_AMOUNT_MISMATCH", { expectedAmount, actualAmount }, cause);
    this.name = "PaymentAmountMismatchError";
  }
}

// ---------------------------------------------------------------------------
// Verification Errors
// ---------------------------------------------------------------------------

/**
 * Thrown when EIP-191 signature verification fails (HTTP 401).
 *
 * Indicates the request signature could not be verified, typically
 * due to an invalid or missing signature header.
 */
export class SignatureVerificationError extends IVXPError {
  constructor(message: string, cause?: unknown) {
    super(message, "SIGNATURE_INVALID", undefined, cause);
    this.name = "SignatureVerificationError";
  }
}

/**
 * Thrown when payment verification fails (HTTP 402).
 *
 * Indicates the payment associated with the request could not be
 * verified on-chain.
 */
export class PaymentVerificationError extends IVXPError {
  constructor(message: string, cause?: unknown) {
    super(message, "PAYMENT_NOT_VERIFIED", undefined, cause);
    this.name = "PaymentVerificationError";
  }
}

// ---------------------------------------------------------------------------
// Order Errors
// ---------------------------------------------------------------------------

/**
 * Thrown when the requested order is not found (HTTP 404).
 *
 * Indicates the specified order ID does not exist in the Provider's
 * order storage.
 */
export class OrderNotFoundError extends IVXPError {
  constructor(message: string, cause?: unknown) {
    super(message, "ORDER_NOT_FOUND", undefined, cause);
    this.name = "OrderNotFoundError";
  }
}

/**
 * Thrown when the requested order has expired.
 *
 * Indicates the order's TTL has been exceeded and is no longer valid
 * for fulfillment.
 */
export class OrderExpiredError extends IVXPError {
  constructor(message: string, cause?: unknown) {
    super(message, "ORDER_EXPIRED", undefined, cause);
    this.name = "OrderExpiredError";
  }
}

// ---------------------------------------------------------------------------
// Network Errors
// ---------------------------------------------------------------------------

/**
 * Thrown when the requested service is unavailable (HTTP 5xx).
 *
 * Indicates the Provider is experiencing an internal error or is
 * temporarily unable to process requests.
 */
export class ServiceUnavailableError extends IVXPError {
  constructor(message: string, cause?: unknown) {
    super(message, "SERVICE_UNAVAILABLE", undefined, cause);
    this.name = "ServiceUnavailableError";
  }
}

// ---------------------------------------------------------------------------
// Polling Errors
// ---------------------------------------------------------------------------

/**
 * Thrown when polling exceeds the maximum number of attempts.
 *
 * Provides the number of attempts that were made for diagnostic
 * purposes.
 */
export class MaxPollAttemptsError extends IVXPError {
  constructor(
    public readonly attempts: number,
    cause?: unknown,
  ) {
    super(`Max polling attempts (${attempts}) exceeded`, "MAX_POLL_ATTEMPTS", { attempts }, cause);
    this.name = "MaxPollAttemptsError";
  }
}

// ---------------------------------------------------------------------------
// Partial Success Error
// ---------------------------------------------------------------------------

/**
 * Thrown when a transaction succeeds but a subsequent operation fails.
 *
 * This is critical for recovery -- the USDC payment was sent on-chain
 * but verification or order submission failed afterward. The txHash
 * allows the user to recover by retrying verification.
 *
 * The `originalError` is forwarded as the error `cause`, enabling
 * standard cause-chain inspection.
 */
export class PartialSuccessError extends IVXPError {
  constructor(
    message: string,
    public readonly txHash: `0x${string}`,
    public readonly recoverable: boolean = true,
    public readonly originalError?: Error,
  ) {
    assertValidTxHash(txHash);
    super(
      message,
      "PARTIAL_SUCCESS",
      {
        txHash,
        recoverable,
        originalError: originalError?.message,
      },
      originalError,
    );
    this.name = "PartialSuccessError";
  }
}

// ---------------------------------------------------------------------------
// Budget Error
// ---------------------------------------------------------------------------

/**
 * Typed quote info exposed by BudgetExceededError for programmatic access.
 *
 * Contains the price and order ID from the quote that exceeded the budget,
 * allowing callers to inspect the quote without casting.
 */
export interface BudgetExceededQuoteInfo {
  /** The order identifier from the quote. */
  readonly orderId: string;
  /** The quoted price in USDC that exceeded the budget. */
  readonly priceUsdc: number;
}

/**
 * Thrown when a service quote price exceeds the configured budget limit.
 *
 * This error is thrown BEFORE any on-chain transaction is initiated,
 * ensuring no USDC is spent when the budget is exceeded. The quote
 * details are attached for diagnostic purposes.
 */
export class BudgetExceededError extends IVXPError {
  /** Typed quote info for programmatic access. */
  public readonly quoteInfo: BudgetExceededQuoteInfo;

  constructor(
    message: string,
    quoteInfo: BudgetExceededQuoteInfo,
    public readonly budgetUsdc: number,
    cause?: unknown,
  ) {
    if (
      typeof quoteInfo.priceUsdc !== "number" ||
      !Number.isFinite(quoteInfo.priceUsdc) ||
      quoteInfo.priceUsdc <= 0
    ) {
      throw new IVXPError(
        "BudgetExceededError: priceUsdc must be a positive finite number",
        "INVALID_ERROR_PARAMS",
        { priceUsdc: quoteInfo.priceUsdc },
      );
    }
    if (typeof quoteInfo.orderId !== "string" || quoteInfo.orderId.length === 0) {
      throw new IVXPError(
        "BudgetExceededError: orderId must be a non-empty string",
        "INVALID_ERROR_PARAMS",
        { orderId: quoteInfo.orderId },
      );
    }

    super(
      message,
      "BUDGET_EXCEEDED",
      { orderId: quoteInfo.orderId, priceUsdc: quoteInfo.priceUsdc, budgetUsdc },
      cause,
    );
    this.name = "BudgetExceededError";
    this.quoteInfo = quoteInfo;
  }
}

// ---------------------------------------------------------------------------
// Timeout Error
// ---------------------------------------------------------------------------

/**
 * Thrown when the requestService flow exceeds the configured timeout.
 *
 * Provides partial state for recovery -- if the payment was already
 * submitted, the txHash is included so the caller can resume or
 * verify the transaction manually.
 */
export class TimeoutError extends IVXPError {
  constructor(
    message: string,
    public readonly step: string,
    public readonly partialState: Record<string, unknown> = {},
    cause?: unknown,
  ) {
    super(message, "TIMEOUT", { step, ...partialState }, cause);
    this.name = "TimeoutError";
  }
}

// ---------------------------------------------------------------------------
// Provider Error
// ---------------------------------------------------------------------------

/**
 * Thrown when a provider is unreachable or returns an unexpected error
 * during the requestService flow.
 *
 * Provides the step at which the error occurred and the provider URL
 * for diagnostic context.
 */
export class ProviderError extends IVXPError {
  constructor(
    message: string,
    public readonly providerUrl: string,
    public readonly step: string,
    cause?: unknown,
  ) {
    super(message, "PROVIDER_ERROR", { providerUrl, step }, cause);
    this.name = "ProviderError";
  }
}
