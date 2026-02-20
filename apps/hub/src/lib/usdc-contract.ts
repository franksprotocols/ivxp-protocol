/**
 * USDC ERC-20 contract configuration for the IVXP Hub.
 *
 * Provides the contract address, ABI subset, and decimal constant
 * needed for balance checks, allowance checks, approvals, and transfers.
 * Address resolution priority:
 * 1) NEXT_PUBLIC_USDC_ADDRESS (global override)
 * 2) Chain-specific env var
 * 3) Known Base USDC defaults
 */

import { erc20Abi, type Address } from "viem";
import { base, baseSepolia } from "wagmi/chains";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const BASE_USDC_MAINNET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const BASE_USDC_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;

const KNOWN_USDC_BY_CHAIN: Readonly<Record<number, Address>> = {
  [base.id]: BASE_USDC_MAINNET,
  [baseSepolia.id]: BASE_USDC_SEPOLIA,
};

function getDefaultChainId(): number {
  return process.env.NODE_ENV === "production" ? base.id : baseSepolia.id;
}

function getGlobalOverride(): Address | null {
  const value = process.env.NEXT_PUBLIC_USDC_ADDRESS as Address | undefined;
  if (!value || value === ZERO_ADDRESS) return null;
  return value;
}

function getChainSpecificOverride(chainId: number): Address | null {
  if (chainId === base.id) {
    const value = process.env.NEXT_PUBLIC_USDC_ADDRESS_BASE_MAINNET as Address | undefined;
    return value && value !== ZERO_ADDRESS ? value : null;
  }

  if (chainId === baseSepolia.id) {
    const value = process.env.NEXT_PUBLIC_USDC_ADDRESS_BASE_SEPOLIA as Address | undefined;
    return value && value !== ZERO_ADDRESS ? value : null;
  }

  return null;
}

/**
 * Resolve USDC contract address for a given chain.
 */
export function getUsdcAddress(chainId: number = getDefaultChainId()): Address {
  const globalOverride = getGlobalOverride();
  if (globalOverride) return globalOverride;

  const chainOverride = getChainSpecificOverride(chainId);
  if (chainOverride) return chainOverride;

  return KNOWN_USDC_BY_CHAIN[chainId] ?? ZERO_ADDRESS;
}

/**
 * USDC contract address on Base (Sepolia or Mainnet).
 * Uses environment overrides first, then known Base defaults.
 */
export const USDC_ADDRESS: Address = getUsdcAddress();

/**
 * Validate that the USDC address is configured for a target chain.
 * Called lazily before any contract interaction to avoid build-time errors.
 */
export function assertUsdcConfigured(chainId?: number): void {
  const resolvedAddress = getUsdcAddress(chainId);
  if (
    resolvedAddress === ZERO_ADDRESS &&
    typeof process !== "undefined" &&
    process.env.NODE_ENV !== "test" &&
    process.env.VITEST !== "true"
  ) {
    throw new Error("USDC contract address is not configured for this chain.");
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
export function getUsdcConfig(chainId?: number) {
  return {
    address: getUsdcAddress(chainId),
    abi: erc20Abi,
  } as const;
}

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
