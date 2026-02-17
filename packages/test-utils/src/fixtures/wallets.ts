/**
 * Test wallet accounts for development and testing.
 *
 * These are Anvil/Hardhat default accounts with well-known private keys.
 * NEVER use these accounts in production or with real funds.
 */

import type { HexAddress } from "@ivxp/protocol";

/**
 * A test wallet account with address and private key.
 */
export interface TestAccount {
  /** Wallet address (checksummed, 0x-prefixed). */
  readonly address: HexAddress;
  /** Private key (0x-prefixed hex). */
  readonly privateKey: HexAddress;
}

/**
 * Pre-defined test wallet accounts from Anvil's default mnemonic.
 *
 * These are deterministic accounts derived from:
 * "test test test test test test test test test test test junk"
 *
 * WARNING: These private keys are publicly known. Never use in production.
 */
export const TEST_ACCOUNTS = {
  /** Account 0 - Used as the client agent in tests. */
  client: {
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as HexAddress,
    privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as HexAddress,
  },
  /** Account 1 - Used as the provider agent in tests. */
  provider: {
    address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as HexAddress,
    privateKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as HexAddress,
  },
  /** Account 2 - Used as an additional third-party account. */
  thirdParty: {
    address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" as HexAddress,
    privateKey: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as HexAddress,
  },
  /** Account 3 - Used as a deployer or admin account. */
  deployer: {
    address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906" as HexAddress,
    privateKey: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6" as HexAddress,
  },
} as const satisfies Record<string, TestAccount>;

/**
 * Mock USDC contract address for Anvil local dev chain.
 *
 * This is the default address for the first contract deployed by the
 * deployer account on a fresh Anvil chain.
 */
export const MOCK_USDC_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3" as const;

/**
 * Default Anvil chain RPC URL.
 */
export const ANVIL_RPC_URL = "http://127.0.0.1:8545" as const;

/**
 * Default Anvil chain ID.
 */
export const ANVIL_CHAIN_ID = 31337 as const;
