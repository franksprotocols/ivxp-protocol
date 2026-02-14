/**
 * IVXP/1.0 Payment Types
 *
 * Defines payment-related types for on-chain USDC transactions.
 * All wire protocol fields use snake_case for Python compatibility.
 */

import type { HexAddress, HexHash, NetworkId } from "./common.js";

// ---------------------------------------------------------------------------
// Payment Info
// ---------------------------------------------------------------------------

/**
 * Payment information required to send USDC on-chain.
 *
 * Derived from a ServiceQuote's quote details.
 */
export interface PaymentInfo {
  /** Recipient wallet address. */
  readonly payment_address: HexAddress;

  /** Amount to pay in USDC. */
  readonly amount_usdc: number;

  /** Blockchain network for the transaction. */
  readonly network: NetworkId;

  /** USDC token contract address (optional; defaults to known USDC address). */
  readonly token_contract?: HexAddress;
}

// ---------------------------------------------------------------------------
// Transaction Reference
// ---------------------------------------------------------------------------

/**
 * Reference to a completed on-chain transaction.
 */
export interface TransactionRef {
  /** On-chain transaction hash. */
  readonly tx_hash: HexHash;

  /** Sender wallet address. */
  readonly from_address: HexAddress;

  /** Recipient wallet address. */
  readonly to_address: HexAddress;

  /** Amount transferred in USDC. */
  readonly amount_usdc: number;

  /** Blockchain network where the transaction occurred. */
  readonly network: NetworkId;

  /** Block number of the transaction (optional). */
  readonly block_number?: number;

  /** Block timestamp as ISO 8601 (optional). */
  readonly block_timestamp?: string;
}

// ---------------------------------------------------------------------------
// Payment Verification Result
// ---------------------------------------------------------------------------

/**
 * Result of verifying an on-chain payment.
 */
export interface PaymentVerificationResult {
  /** Whether the payment was successfully verified. */
  readonly verified: boolean;

  /** Transaction hash that was verified. */
  readonly tx_hash: HexHash;

  /** Actual amount found in the transaction (USDC). */
  readonly actual_amount_usdc?: number;

  /** Expected amount (USDC). */
  readonly expected_amount_usdc?: number;

  /** Reason for verification failure (if not verified). */
  readonly failure_reason?: string;
}

// ---------------------------------------------------------------------------
// USDC Contract Constants
// ---------------------------------------------------------------------------

/**
 * Known USDC contract addresses by network.
 */
export const USDC_CONTRACT_ADDRESSES: Readonly<Record<NetworkId, HexAddress>> =
  {
    "base-mainnet": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "base-sepolia": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  } as const;

/**
 * USDC token decimals (always 6).
 */
export const USDC_DECIMALS = 6 as const;
