/**
 * IPaymentService -- Interface for USDC payment operations on Base L2.
 *
 * Provides methods to send USDC, verify on-chain transactions, and
 * query balances.
 *
 * **Amount format**: All amounts in this interface use `string` representation
 * for precision (e.g. "30.00", "0.500000"). This avoids JavaScript floating-point
 * issues when working with USDC's 6-decimal precision. The wire protocol types
 * (`QuoteDetails.price_usdc`, etc.) use `number` for JSON ergonomics; conversion
 * between formats must happen at the API boundary layer using
 * `parseFloat()` / `toFixed(6)` or a decimal library.
 *
 * Designed for dependency injection: SDK consumers can provide their own
 * implementation (e.g., using viem, ethers.js, or mock for testing).
 */

/**
 * Expected payment details for on-chain verification.
 */
export interface PaymentExpectedDetails {
  /** Sender wallet address. */
  readonly from: `0x${string}`;

  /** Recipient wallet address. */
  readonly to: `0x${string}`;

  /**
   * Expected amount in USDC as a string for precision.
   *
   * Uses string to avoid JavaScript floating-point issues with USDC's
   * 6-decimal precision. The wire protocol types use `number`; conversion
   * must happen at the API boundary.
   */
  readonly amount: string;
}

/**
 * Service interface for USDC payment operations.
 *
 * Responsibilities:
 * - Send USDC transfers to recipient addresses
 * - Verify on-chain payment transactions match expected details
 * - Query USDC balances for any address
 */
export interface IPaymentService {
  /**
   * Send USDC to a recipient address on Base L2.
   *
   * @param to - Recipient wallet address
   * @param amount - Amount in USDC (string for precision, e.g. "30.00")
   * @returns Transaction hash of the submitted transfer
   */
  send(to: `0x${string}`, amount: string): Promise<`0x${string}`>;

  /**
   * Verify an on-chain USDC payment matches the expected details.
   *
   * Checks that the transaction exists, is confirmed, and that the
   * sender, recipient, and amount all match the expected values.
   *
   * @param txHash - Transaction hash to verify
   * @param expected - Expected transaction details (from, to, amount)
   * @returns true if all conditions match and the transaction is confirmed
   */
  verify(txHash: `0x${string}`, expected: PaymentExpectedDetails): Promise<boolean>;

  /**
   * Get the USDC balance for a wallet address.
   *
   * @param address - Wallet address to query
   * @returns USDC balance as a human-readable decimal string with up to
   *          6 decimal places (e.g. "100.500000", "0.010000"). Implementations
   *          must format the raw on-chain value (6 decimals) into this format.
   */
  getBalance(address: `0x${string}`): Promise<string>;

  /**
   * Get the status of a transaction on-chain.
   *
   * Provides transaction status information including confirmation count.
   * Useful for checking whether a payment has been confirmed before
   * calling verify().
   *
   * @param txHash - Transaction hash to check
   * @returns Transaction status object with status, blockNumber, and confirmations
   */
  getTransactionStatus(txHash: `0x${string}`): Promise<{
    readonly status: "pending" | "success" | "reverted" | "not_found";
    readonly confirmations?: number;
    readonly blockNumber?: bigint;
  }>;
}
