/**
 * Shared helpers for full-flow integration tests (Story 3.11).
 *
 * Provides reusable constants, client factory, and a helper to mint USDC
 * and create a pre-funded test client. Eliminates duplication across the
 * split test files (success, events, errors, isolation).
 */

import { TEST_ACCOUNTS, type AnvilTestClient } from "@ivxp/test-utils";
import { IVXPClient, type IVXPClientConfig } from "../../core/client.js";
import {
  setupTestEnvironment,
  mintMockUSDC,
  createTestPaymentService,
  createTestCryptoService,
  type IntegrationTestEnv,
} from "./setup.js";
import { type MockProviderResult } from "./mock-provider.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CLIENT_KEY = TEST_ACCOUNTS.client.privateKey as `0x${string}`;
export const PROVIDER_ADDRESS = TEST_ACCOUNTS.provider.address as `0x${string}`;
export const CLIENT_ADDRESS = TEST_ACCOUNTS.client.address as `0x${string}`;

/** Default poll options for fast test execution. */
export const FAST_POLL_OPTIONS = {
  initialDelay: 10,
  maxDelay: 50,
  maxAttempts: 10,
} as const;

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

/**
 * Create an IVXPClient for integration testing.
 *
 * Uses real CryptoService and PaymentService (connected to Anvil),
 * and a mock provider's HttpClient for provider HTTP calls.
 */
export function createIntegrationClient(
  mockProvider: MockProviderResult,
  mockUsdcAddress: `0x${string}`,
): IVXPClient {
  const config: IVXPClientConfig = {
    privateKey: CLIENT_KEY,
    network: "base-sepolia",
    httpClient: mockProvider.httpClient,
    cryptoService: createTestCryptoService(CLIENT_KEY),
    paymentService: createTestPaymentService(CLIENT_KEY, mockUsdcAddress),
  };

  return new IVXPClient(config);
}

// ---------------------------------------------------------------------------
// Funded client helper (Fix #10: DRY)
// ---------------------------------------------------------------------------

/**
 * Mint USDC and create an integration client in one call.
 *
 * Reduces boilerplate in tests that all need the same pattern:
 *   1. Mint USDC to the client address
 *   2. Create a mock provider
 *   3. Create an IVXPClient with real crypto/payment and mock HTTP
 *
 * @param testClient - Anvil test client for mining/minting
 * @param mockUsdcAddress - Address of the deployed mock USDC contract
 * @param mockProvider - The mock provider to inject into the client
 * @param usdcAmount - Amount of USDC to mint (defaults to "500")
 * @returns The created IVXPClient
 */
export async function createFundedClient(
  testClient: AnvilTestClient,
  mockUsdcAddress: `0x${string}`,
  mockProvider: MockProviderResult,
  usdcAmount: string = "500",
): Promise<IVXPClient> {
  await mintMockUSDC(testClient, mockUsdcAddress, CLIENT_ADDRESS, usdcAmount);
  return createIntegrationClient(mockProvider, mockUsdcAddress);
}

// ---------------------------------------------------------------------------
// Environment setup (singleton)
// ---------------------------------------------------------------------------

/**
 * Cached environment promise. When multiple test files call
 * initTestEnvironment(), only the first call deploys the contract.
 * Subsequent calls reuse the same promise, avoiding nonce conflicts.
 */
let cachedEnvPromise: Promise<IntegrationTestEnv> | null = null;

/**
 * Initialize the integration test environment with descriptive error on failure.
 *
 * Uses a singleton cache so that when vitest runs multiple test files
 * sequentially (fileParallelism: false), all files share the same
 * deployed mock USDC contract and Anvil test client.
 */
export function initTestEnvironment(): Promise<IntegrationTestEnv> {
  if (cachedEnvPromise === null) {
    cachedEnvPromise = setupTestEnvironment().catch((error) => {
      // Reset cache so next attempt can retry
      cachedEnvPromise = null;
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Integration test setup failed -- is Anvil running on http://127.0.0.1:8545? ` +
          `Start it with: anvil & \nOriginal error: ${message}`,
      );
    });
  }
  return cachedEnvPromise;
}
