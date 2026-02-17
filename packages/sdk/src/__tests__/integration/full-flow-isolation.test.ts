/**
 * Integration tests: test isolation (Story 3.11, AC #4)
 *
 * Tests that integration tests are isolated and reproducible. Each
 * createMockProvider() call creates a new closure-scoped counter, so
 * no manual counter reset is needed (Fix #7).
 *
 * Requires Anvil running on http://127.0.0.1:8545
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { type AnvilTestClient } from "@ivxp/test-utils";
import { type IntegrationTestEnv } from "./setup.js";
import { createMockProvider } from "./mock-provider.js";
import {
  PROVIDER_ADDRESS,
  FAST_POLL_OPTIONS,
  createFundedClient,
  initTestEnvironment,
} from "./full-flow-helpers.js";

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("test isolation (AC #4)", () => {
  let testEnv: IntegrationTestEnv;
  let testClient: AnvilTestClient;
  let mockUsdcAddress: `0x${string}`;

  beforeAll(async () => {
    testEnv = await initTestEnvironment();
    testClient = testEnv.testClient;
    mockUsdcAddress = testEnv.mockUsdcAddress;
  }, 30_000);

  afterAll(async () => {
    await testClient.mine({ blocks: 5 });
  });

  beforeEach(async () => {
    // No manual resetMockOrderCounter() needed -- counter is closure-scoped
    // per createMockProvider() call (Fix #7)
    await testClient.mine({ blocks: 1 });
  });

  it("should produce independent results across sequential test runs", async () => {
    // Run 1: separate provider instance with its own counter
    const mockProvider1 = createMockProvider({
      providerAddress: PROVIDER_ADDRESS,
      basePriceUsdc: 5,
    });
    const client1 = await createFundedClient(testClient, mockUsdcAddress, mockProvider1, "2000");
    const result1 = await client1.requestService({
      providerUrl: mockProvider1.providerUrl,
      serviceType: "test_service",
      description: "Isolation test run 1",
      budgetUsdc: 10,
      pollOptions: FAST_POLL_OPTIONS,
    });

    // Run 2: new provider instance with its own counter (no manual reset)
    const mockProvider2 = createMockProvider({
      providerAddress: PROVIDER_ADDRESS,
      basePriceUsdc: 5,
    });
    const client2 = await createFundedClient(testClient, mockUsdcAddress, mockProvider2, "2000");
    const result2 = await client2.requestService({
      providerUrl: mockProvider2.providerUrl,
      serviceType: "test_service",
      description: "Isolation test run 2",
      budgetUsdc: 10,
      pollOptions: FAST_POLL_OPTIONS,
    });

    // Both should succeed independently
    expect(result1.status).toBe("confirmed");
    expect(result2.status).toBe("confirmed");

    // Different tx hashes (real on-chain transactions)
    expect(result1.paymentTxHash).not.toBe(result2.paymentTxHash);
  });

  it("should handle multiple sequential orders through the same client", async () => {
    const mockProvider = createMockProvider({
      providerAddress: PROVIDER_ADDRESS,
      basePriceUsdc: 3,
    });
    const client = await createFundedClient(testClient, mockUsdcAddress, mockProvider, "5000");

    const orderIds: string[] = [];
    const txHashes: string[] = [];

    // Execute 3 orders sequentially
    for (let i = 0; i < 3; i++) {
      const result = await client.requestService({
        providerUrl: mockProvider.providerUrl,
        serviceType: "test_service",
        description: `Sequential order ${i + 1}`,
        budgetUsdc: 10,
        pollOptions: FAST_POLL_OPTIONS,
      });

      expect(result.status).toBe("confirmed");
      orderIds.push(result.orderId);
      txHashes.push(result.paymentTxHash);
    }

    // All orders should have unique IDs
    const uniqueOrderIds = new Set(orderIds);
    expect(uniqueOrderIds.size).toBe(3);

    // All transactions should be unique
    const uniqueTxHashes = new Set(txHashes);
    expect(uniqueTxHashes.size).toBe(3);

    // All orders should be tracked by the provider
    expect(mockProvider.getOrders().size).toBe(3);
  });
});
