/**
 * Chain fixture for interop tests.
 *
 * Sets up an Anvil test client and deploys a mock USDC contract.
 * Reuses the integration test setup helpers to avoid duplication.
 */

import { createTestChain, type AnvilTestClient } from "@ivxp/test-utils";
import { deployMockERC20, mintMockUSDC } from "../../integration/setup.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChainFixture {
  readonly testClient: AnvilTestClient;
  readonly mockUsdcAddress: `0x${string}`;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

let cachedFixture: Promise<ChainFixture> | null = null;

/**
 * Initialize the chain fixture (singleton).
 *
 * Deploys mock USDC on first call; subsequent calls reuse the same instance.
 * Requires Anvil running on http://127.0.0.1:8545.
 */
export function initChainFixture(): Promise<ChainFixture> {
  if (cachedFixture === null) {
    cachedFixture = createChainFixture().catch((error) => {
      cachedFixture = null;
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Chain fixture setup failed -- is Anvil running? ` +
          `Start with: anvil &\nOriginal error: ${msg}`,
      );
    });
  }
  return cachedFixture;
}

async function createChainFixture(): Promise<ChainFixture> {
  const testClient = createTestChain();
  const mockUsdcAddress = await deployMockERC20(testClient);
  return { testClient, mockUsdcAddress };
}

/**
 * Mint mock USDC to an address using the chain fixture.
 */
export async function mintUSDC(
  fixture: ChainFixture,
  to: `0x${string}`,
  amount: string,
): Promise<void> {
  await mintMockUSDC(fixture.testClient, fixture.mockUsdcAddress, to, amount);
}
