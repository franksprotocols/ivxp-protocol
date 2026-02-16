/**
 * USDC ERC-20 contract configuration for the IVXP Hub.
 *
 * Provides the contract address, ABI subset, and decimal constant
 * needed for balance checks, allowance checks, approvals, and transfers.
 * The address is read from the NEXT_PUBLIC_USDC_ADDRESS environment variable.
 */

import { erc20Abi, type Address } from "viem";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

/**
 * USDC contract address on Base (Sepolia or Mainnet).
 * Falls back to zero address ONLY in test environments.
 * Throws at runtime if zero address is used outside of test/development.
 */
export const USDC_ADDRESS: Address =
  (process.env.NEXT_PUBLIC_USDC_ADDRESS as Address | undefined) ?? ZERO_ADDRESS;

/**
 * Validate that the USDC address is configured in non-test environments.
 * Called lazily before any contract interaction to avoid build-time errors.
 */
export function assertUsdcConfigured(): void {
  if (
    USDC_ADDRESS === ZERO_ADDRESS &&
    typeof process !== "undefined" &&
    process.env.NODE_ENV !== "test" &&
    process.env.VITEST !== "true"
  ) {
    throw new Error(
      "USDC contract address is not configured. Set NEXT_PUBLIC_USDC_ADDRESS environment variable.",
    );
  }
}

/** USDC uses 6 decimal places. */
export const USDC_DECIMALS = 6 as const;

/**
 * Base Sepolia block explorer base URL for transaction links.
 * Configurable via env var for mainnet/testnet switching.
 */
export const EXPLORER_BASE_URL =
  process.env.NEXT_PUBLIC_EXPLORER_URL ?? "https://sepolia.basescan.org";

/**
 * Wagmi-compatible contract config for USDC read/write operations.
 * Uses the standard ERC-20 ABI which includes balanceOf, allowance,
 * approve, and transfer functions.
 */
export const usdcConfig = {
  address: USDC_ADDRESS,
  abi: erc20Abi,
} as const;

/**
 * Build a block explorer URL for a transaction hash.
 */
export function getExplorerTxUrl(txHash: string): string {
  return `${EXPLORER_BASE_URL}/tx/${txHash}`;
}
