/**
 * Chain mock utilities for Anvil-based testing.
 *
 * Provides helpers for creating test clients connected to a local
 * Anvil instance using viem's test utilities.
 */

import {
  createTestClient,
  http,
  publicActions,
  walletActions,
  type Chain,
  type PublicActions,
  type TestClient,
  type WalletActions,
} from "viem";
import { foundry } from "viem/chains";

import { ANVIL_RPC_URL } from "../fixtures/wallets.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A fully-featured test client with public, wallet, and test actions.
 */
export type AnvilTestClient = TestClient<"anvil"> & PublicActions & WalletActions;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Configuration for creating a test chain client.
 */
export interface TestChainConfig {
  /** RPC URL for the Anvil instance. Defaults to ANVIL_RPC_URL. */
  readonly rpcUrl?: string;
  /** Chain definition. Defaults to viem's foundry chain. */
  readonly chain?: Chain;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a test client connected to a local Anvil instance.
 *
 * The returned client has public, wallet, and test actions available.
 *
 * @param config - Optional chain configuration overrides.
 * @returns A viem TestClient with extended capabilities.
 *
 * @example
 * ```typescript
 * const client = createTestChain();
 * const blockNumber = await client.getBlockNumber();
 * ```
 */
export const createTestChain = (config: TestChainConfig = {}): AnvilTestClient => {
  const rpcUrl = config.rpcUrl ?? ANVIL_RPC_URL;
  const chain = config.chain ?? foundry;

  return createTestClient({
    chain,
    mode: "anvil",
    // jsdom tests can expose an AbortSignal class mismatch with Node fetch.
    // timeout: 0 prevents viem from injecting a signal into RequestInit.
    transport: http(rpcUrl, { timeout: 0 }),
  })
    .extend(publicActions)
    .extend(walletActions);
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * The foundry chain configuration from viem.
 * Useful for chain-specific test setup.
 */
export { foundry as anvilChain };
