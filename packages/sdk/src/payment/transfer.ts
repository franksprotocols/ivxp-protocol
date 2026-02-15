/**
 * PaymentService -- USDC transfer service for Base L2.
 *
 * Implements the IPaymentService interface from @ivxp/protocol using viem
 * for all blockchain operations. Supports both Base Mainnet and Base Sepolia.
 *
 * Features:
 * - Send USDC transfers to recipient addresses
 * - Query USDC balances for any address
 * - Balance pre-check before sending (throws InsufficientBalanceError)
 * - Transaction receipt waiting with revert detection
 * - Factory function for convenient instantiation
 * - Dependency injection for viem clients (testability)
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  type PublicClient,
  type WalletClient,
  type Transport,
  type Chain,
  type HttpTransport,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";
import type { IPaymentService, PaymentExpectedDetails } from "@ivxp/protocol";
import { USDC_CONTRACT_ADDRESSES, USDC_DECIMALS } from "@ivxp/protocol";
import {
  InsufficientBalanceError,
  TransactionError,
  TransactionSubmissionError,
  PaymentNotFoundError,
  PaymentPendingError,
  PaymentFailedError,
  PaymentAmountMismatchError,
} from "../errors/index.js";

// ---------------------------------------------------------------------------
// Validation constants
// ---------------------------------------------------------------------------

/** Regex for a valid 0x-prefixed 32-byte hex private key (66 chars total). */
const PRIVATE_KEY_REGEX = /^0x[0-9a-fA-F]{64}$/;

/** Regex for a valid 0x-prefixed 20-byte hex address (42 chars total). */
const HEX_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;

// ---------------------------------------------------------------------------
// ERC-20 Transfer event topic
// ---------------------------------------------------------------------------

/**
 * Keccak-256 hash of the ERC-20 Transfer event signature.
 *
 * Pre-computed from: `keccak256(toHex("Transfer(address,address,uint256)"))`
 *
 * This is the topic[0] value emitted by all ERC-20 Transfer events,
 * used to identify USDC transfer logs when verifying payments.
 */
const ERC20_TRANSFER_EVENT_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" as const;

// ---------------------------------------------------------------------------
// USDC ABI (minimal -- only functions we need)
// ---------------------------------------------------------------------------

const USDC_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Supported network types for the PaymentService.
 */
export type NetworkType = "base-mainnet" | "base-sepolia";

/**
 * Optional viem client overrides for dependency injection.
 *
 * Used primarily for testing: supply clients connected to a local
 * Anvil chain instead of the production Base network.
 */
export interface PaymentClientOverrides {
  /** Override the wallet client (for signing and sending transactions). */
  readonly walletClient?: WalletClient<HttpTransport, Chain, PrivateKeyAccount>;
  /** Override the public client (for reading chain state). */
  readonly publicClient?: PublicClient<Transport, Chain>;
  /** Override the USDC contract address. */
  readonly usdcAddress?: `0x${string}`;
}

/**
 * Configuration for creating a PaymentService instance.
 */
export interface PaymentServiceConfig {
  /** The 0x-prefixed hex private key (32 bytes). */
  readonly privateKey: `0x${string}`;
  /** The network to use. Defaults to "base-sepolia". */
  readonly network?: NetworkType;
  /** Optional RPC URL override. Defaults to public RPC for the network. */
  readonly rpcUrl?: string;
  /**
   * Optional client overrides for dependency injection.
   *
   * When provided, these clients are used instead of creating new ones
   * from the privateKey/network/rpcUrl configuration. Primarily useful
   * for testing with local chains (e.g. Anvil).
   */
  readonly overrides?: PaymentClientOverrides;
}

// ---------------------------------------------------------------------------
// Chain mapping
// ---------------------------------------------------------------------------

const CHAIN_MAP: Readonly<Record<NetworkType, Chain>> = {
  "base-mainnet": base,
  "base-sepolia": baseSepolia,
} as const;

// ---------------------------------------------------------------------------
// RPC errors that indicate a system/infrastructure failure
// (as opposed to a verification mismatch)
// ---------------------------------------------------------------------------

/**
 * Check whether an error is a transient network/RPC failure that should
 * be surfaced to the caller rather than silently treated as "not verified".
 *
 * Handles both Error instances and non-Error thrown values by coercing
 * to a string for pattern matching.
 */
function isSystemError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();

  // HTTP / fetch failures
  if (message.includes("fetch failed") || message.includes("econnrefused")) {
    return true;
  }

  // Timeout
  if (message.includes("timeout") || message.includes("timed out")) {
    return true;
  }

  // Rate limiting
  if (message.includes("429") || message.includes("rate limit")) {
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// PaymentService
// ---------------------------------------------------------------------------

/**
 * USDC payment service for Base L2.
 *
 * Provides methods to send USDC transfers, check balances, and verify
 * on-chain transactions. Uses viem for all blockchain operations.
 *
 * Implements the IPaymentService interface from @ivxp/protocol.
 */
export class PaymentService implements IPaymentService {
  private readonly walletClient: WalletClient<HttpTransport, Chain, PrivateKeyAccount>;
  private readonly publicClient: PublicClient<Transport, Chain>;
  private readonly usdcAddress: `0x${string}`;
  private readonly account: PrivateKeyAccount;

  /**
   * Create a new PaymentService instance.
   *
   * @param config - Service configuration (privateKey, network, optional rpcUrl, optional overrides)
   * @throws If the private key format is invalid
   * @throws If the network is not supported
   * @throws If the rpcUrl is not a valid URL
   */
  constructor(config: PaymentServiceConfig) {
    const { privateKey, network = "base-sepolia", rpcUrl, overrides } = config;

    if (!privateKey || !PRIVATE_KEY_REGEX.test(privateKey)) {
      throw new Error(
        "Invalid private key: must be a 0x-prefixed 64-character hex string (32 bytes)",
      );
    }

    // Validate rpcUrl if provided (Fix #5)
    if (rpcUrl !== undefined) {
      try {
        new URL(rpcUrl);
      } catch {
        throw new Error(`Invalid rpcUrl: "${rpcUrl}" is not a valid URL`);
      }
    }

    const chain = CHAIN_MAP[network];
    if (!chain) {
      throw new Error(`Unsupported network: ${network}. Must be "base-mainnet" or "base-sepolia".`);
    }

    this.account = privateKeyToAccount(privateKey);
    this.usdcAddress = overrides?.usdcAddress ?? USDC_CONTRACT_ADDRESSES[network];

    // Use injected clients if provided, otherwise create from config
    this.walletClient =
      overrides?.walletClient ??
      createWalletClient({
        account: this.account,
        chain,
        transport: http(rpcUrl),
      });

    this.publicClient =
      overrides?.publicClient ??
      createPublicClient({
        chain,
        transport: http(rpcUrl),
      });
  }

  /**
   * Get the USDC balance for a wallet address.
   *
   * Reads the USDC contract's balanceOf function and returns the balance
   * formatted as a decimal string with up to 6 decimal places.
   *
   * @param address - Wallet address to query
   * @returns USDC balance as a human-readable decimal string (e.g. "100.500000")
   * @throws If the address format is invalid
   */
  async getBalance(address: `0x${string}`): Promise<string> {
    if (!address || !HEX_ADDRESS_REGEX.test(address)) {
      throw new Error("Invalid address: must be a 0x-prefixed 40-character hex string (20 bytes)");
    }

    const balance = await this.publicClient.readContract({
      address: this.usdcAddress,
      abi: USDC_ABI,
      functionName: "balanceOf",
      args: [address],
    });

    return formatUnits(balance, USDC_DECIMALS);
  }

  /**
   * Send USDC to a recipient address on Base L2.
   *
   * Checks the sender's balance before submitting the transfer.
   * Waits for the transaction to be confirmed and verifies success.
   *
   * @param to - Recipient wallet address
   * @param amount - Amount in USDC (string for precision, e.g. "30.00")
   * @returns Transaction hash of the confirmed transfer
   * @throws InsufficientBalanceError if the sender's balance is too low
   * @throws TransactionError if the transaction reverts (includes txHash)
   * @throws TransactionSubmissionError if the transaction cannot be submitted
   * @throws Error if the recipient address or amount is invalid
   */
  async send(to: `0x${string}`, amount: string): Promise<`0x${string}`> {
    // Validate recipient address
    if (!to || !HEX_ADDRESS_REGEX.test(to)) {
      throw new Error(
        "Invalid recipient address: must be a 0x-prefixed 40-character hex string (20 bytes)",
      );
    }

    // Validate amount format: parseUnits will throw for invalid strings,
    // but we also need to reject non-positive values.
    let amountInSmallestUnit: bigint;
    try {
      amountInSmallestUnit = parseUnits(amount, USDC_DECIMALS);
    } catch {
      throw new Error("Invalid amount: must be a positive number string (e.g. '10.00')");
    }

    if (amountInSmallestUnit <= 0n) {
      throw new Error("Invalid amount: must be a positive number string (e.g. '10.00')");
    }

    // Check balance before sending -- use BigInt comparison (Fix #3)
    const balanceRaw = await this.publicClient.readContract({
      address: this.usdcAddress,
      abi: USDC_ABI,
      functionName: "balanceOf",
      args: [this.account.address],
    });

    if (balanceRaw < amountInSmallestUnit) {
      const balanceFormatted = formatUnits(balanceRaw, USDC_DECIMALS);
      throw new InsufficientBalanceError(
        `Insufficient USDC balance: ${balanceFormatted} < ${amount}`,
        balanceFormatted,
        amount,
      );
    }

    // Submit the transfer
    let hash: `0x${string}`;
    try {
      hash = await this.walletClient.writeContract({
        address: this.usdcAddress,
        abi: USDC_ABI,
        functionName: "transfer",
        args: [to, amountInSmallestUnit],
      });
    } catch (error) {
      throw new TransactionSubmissionError(
        `Failed to submit USDC transfer: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }

    // Wait for transaction confirmation
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === "reverted") {
      throw new TransactionError(`Transaction reverted: ${hash}`, hash);
    }

    return hash;
  }

  /**
   * Verify an on-chain USDC payment matches expected details.
   *
   * Checks the transaction receipt and logs to confirm that the
   * sender, recipient, and amount match the expected values.
   *
   * Returns true only when all conditions match. Returns false when
   * the sender or recipient does not match (soft mismatch). Throws
   * specific error types for actionable failure modes:
   * - PaymentNotFoundError: transaction or USDC transfer not found
   * - PaymentPendingError: transaction exists but not yet mined
   * - PaymentFailedError: transaction was mined but reverted
   * - PaymentAmountMismatchError: USDC amount differs from expected
   *
   * Re-throws system errors (network, timeout, rate limit) so callers
   * can distinguish transient failures from verification failures.
   *
   * @param txHash - Transaction hash to verify
   * @param expected - Expected transaction details (from, to, amount)
   * @returns true if all conditions match and the transaction is confirmed
   * @throws PaymentNotFoundError when transaction or transfer event not found
   * @throws PaymentPendingError when transaction is still pending
   * @throws PaymentFailedError when transaction reverted on-chain
   * @throws PaymentAmountMismatchError when transfer amount differs
   * @throws When a system error occurs (network failure, timeout, rate limit)
   */
  async verify(txHash: `0x${string}`, expected: PaymentExpectedDetails): Promise<boolean> {
    // Step 1: Fetch the transaction receipt
    let receipt;
    try {
      receipt = await this.publicClient.getTransactionReceipt({ hash: txHash });
    } catch (error) {
      // Re-throw system errors immediately
      if (isSystemError(error)) {
        throw error;
      }

      // Receipt not available -- check if transaction is pending
      try {
        const tx = await this.publicClient.getTransaction({ hash: txHash });
        if (tx && !tx.blockNumber) {
          throw new PaymentPendingError(`Transaction ${txHash} is still pending`);
        }
      } catch (innerError) {
        // If the inner check itself is a PaymentPendingError, re-throw
        if (innerError instanceof PaymentPendingError) {
          throw innerError;
        }
        // Re-throw system errors from the inner call
        if (isSystemError(innerError)) {
          throw innerError;
        }
      }

      // Transaction truly not found
      throw new PaymentNotFoundError(`Transaction ${txHash} not found on chain`);
    }

    // Step 2: Check transaction status
    if (receipt.status === "reverted") {
      throw new PaymentFailedError(`Transaction ${txHash} reverted`, txHash);
    }

    // Step 3: Verify the sender (available on the receipt directly)
    if (receipt.from.toLowerCase() !== expected.from.toLowerCase()) {
      return false;
    }

    // Step 4: Verify the transaction was to the USDC contract
    if (receipt.to?.toLowerCase() !== this.usdcAddress.toLowerCase()) {
      throw new PaymentNotFoundError(`No USDC transfer found in transaction ${txHash}`);
    }

    // Step 5: Find the Transfer event from the USDC contract
    const transferLog = receipt.logs.find(
      (log) =>
        log.topics[0] === ERC20_TRANSFER_EVENT_TOPIC &&
        log.address.toLowerCase() === this.usdcAddress.toLowerCase(),
    );

    if (!transferLog) {
      throw new PaymentNotFoundError(`No USDC transfer event found in transaction ${txHash}`);
    }

    // Step 6: Verify the recipient from the Transfer event
    // Topic[2] is the 'to' address in a Transfer event (padded to 32 bytes)
    const rawToTopic = transferLog.topics[2];
    if (!rawToTopic || rawToTopic.length < 66) {
      throw new PaymentNotFoundError(
        `Malformed Transfer event in transaction ${txHash}: missing recipient topic`,
      );
    }
    const toAddress = `0x${rawToTopic.slice(26)}` as `0x${string}`;
    if (toAddress.toLowerCase() !== expected.to.toLowerCase()) {
      return false;
    }

    // Step 7: Verify the amount
    const actualAmount = BigInt(transferLog.data);
    const expectedAmount = parseUnits(expected.amount, USDC_DECIMALS);

    if (actualAmount !== expectedAmount) {
      throw new PaymentAmountMismatchError(
        `Amount mismatch: expected ${expected.amount} USDC, got ${formatUnits(actualAmount, USDC_DECIMALS)} USDC`,
        expected.amount,
        formatUnits(actualAmount, USDC_DECIMALS),
      );
    }

    return true;
  }

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
  async getTransactionStatus(txHash: `0x${string}`): Promise<{
    readonly status: "pending" | "success" | "reverted" | "not_found";
    readonly confirmations?: number;
    readonly blockNumber?: bigint;
  }> {
    // Try to get the receipt first (confirmed transactions)
    const receipt = await this.publicClient
      .getTransactionReceipt({ hash: txHash })
      .catch(() => null);

    if (!receipt) {
      // Check if the transaction exists but is unconfirmed
      const tx = await this.publicClient.getTransaction({ hash: txHash }).catch(() => null);

      if (tx) {
        return { status: "pending" } as const;
      }

      return { status: "not_found" } as const;
    }

    const currentBlock = await this.publicClient.getBlockNumber();

    return {
      status: receipt.status,
      blockNumber: receipt.blockNumber,
      confirmations: Number(currentBlock - receipt.blockNumber),
    } as const;
  }

  /**
   * Get the wallet address associated with this payment service.
   *
   * @returns The hex-encoded wallet address (0x-prefixed, checksummed)
   */
  getAddress(): `0x${string}` {
    return this.account.address;
  }
}

// ---------------------------------------------------------------------------
// Factory function
// ---------------------------------------------------------------------------

/**
 * Create a new PaymentService instance.
 *
 * Factory function that returns an IPaymentService-typed instance,
 * hiding the concrete PaymentService class behind the interface.
 *
 * @param config - Service configuration
 * @returns An IPaymentService implementation
 *
 * @example
 * ```typescript
 * import { createPaymentService } from "@ivxp/sdk";
 *
 * const payment = createPaymentService({
 *   privateKey: "0x...",
 *   network: "base-sepolia",
 * });
 *
 * // Send 10 USDC to a recipient
 * const txHash = await payment.send("0xRecipient...", "10.00");
 *
 * // Check balance
 * const balance = await payment.getBalance("0xAddress...");
 * ```
 */
export function createPaymentService(config: PaymentServiceConfig): IPaymentService {
  return new PaymentService(config);
}
