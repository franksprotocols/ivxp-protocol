/**
 * Specific IVXP SDK error classes.
 *
 * Each error class extends IVXPError with a predefined code
 * and domain-specific context fields.
 */

import { IVXPError } from "./base.js";

/**
 * Thrown when a USDC transfer fails due to insufficient balance.
 *
 * Provides the available balance and the required amount for
 * diagnostic purposes.
 */
export class InsufficientBalanceError extends IVXPError {
  constructor(
    message: string,
    public readonly availableBalance: string,
    public readonly requiredAmount: string,
    cause?: unknown,
  ) {
    super(message, "INSUFFICIENT_BALANCE", cause);
    this.name = "InsufficientBalanceError";
  }
}

/**
 * Thrown when a confirmed blockchain transaction fails or reverts.
 *
 * The txHash is required because this error represents a transaction
 * that was submitted and received a receipt, but the receipt shows failure.
 */
export class TransactionError extends IVXPError {
  constructor(
    message: string,
    public readonly txHash: `0x${string}`,
    cause?: unknown,
  ) {
    super(message, "TRANSACTION_FAILED", cause);
    this.name = "TransactionError";
  }
}

/**
 * Thrown when a blockchain transaction cannot be submitted to the network.
 *
 * No txHash is available because the transaction was rejected before
 * being included in a block (e.g. RPC failure, nonce error, gas estimation).
 */
export class TransactionSubmissionError extends IVXPError {
  constructor(message: string, cause?: unknown) {
    super(message, "TRANSACTION_SUBMISSION_FAILED", cause);
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
    super(message, "PAYMENT_NOT_FOUND", cause);
    this.name = "PaymentNotFoundError";
  }
}

/**
 * Thrown when a transaction exists but has not yet been included in a block.
 *
 * The caller should wait and retry verification later.
 */
export class PaymentPendingError extends IVXPError {
  constructor(message: string, cause?: unknown) {
    super(message, "PAYMENT_PENDING", cause);
    this.name = "PaymentPendingError";
  }
}

/**
 * Thrown when a transaction was confirmed but reverted on-chain.
 *
 * The txHash is included for diagnostic purposes.
 */
export class PaymentFailedError extends IVXPError {
  constructor(
    message: string,
    public readonly txHash: `0x${string}`,
    cause?: unknown,
  ) {
    super(message, "PAYMENT_FAILED", cause);
    this.name = "PaymentFailedError";
  }
}

/**
 * Thrown when the on-chain transfer amount does not match the expected amount.
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
    super(message, "PAYMENT_AMOUNT_MISMATCH", cause);
    this.name = "PaymentAmountMismatchError";
  }
}
