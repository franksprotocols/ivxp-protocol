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
