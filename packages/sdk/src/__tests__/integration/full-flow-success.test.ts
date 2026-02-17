/**
 * Integration tests: requestService full flow (Story 3.11, AC #1)
 *
 * Tests the complete `requestService` flow from quote through confirmed
 * using a mock provider and Anvil (local blockchain).
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

describe("requestService full flow (AC #1)", () => {
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
    await testClient.mine({ blocks: 1 });
  });

  it("should complete entire flow from quote to confirmed", async () => {
    const mockProvider = createMockProvider({
      providerAddress: PROVIDER_ADDRESS,
      basePriceUsdc: 10,
    });
    const client = await createFundedClient(testClient, mockUsdcAddress, mockProvider, "1000");

    const result = await client.requestService({
      providerUrl: mockProvider.providerUrl,
      serviceType: "test_service",
      description: "Integration test request",
      budgetUsdc: 15,
      pollOptions: FAST_POLL_OPTIONS,
    });

    expect(result.status).toBe("confirmed");
    expect(result.orderId).toBeDefined();
    expect(result.orderId).toMatch(/^ivxp-mock-/);
    expect(result.paymentTxHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    expect(result.confirmedAt).toBeDefined();
    expect(result.quote).toBeDefined();
    expect(result.quote.quote.priceUsdc).toBe(10);
  });

  it("should verify all protocol steps completed in order", async () => {
    const mockProvider = createMockProvider({
      providerAddress: PROVIDER_ADDRESS,
      basePriceUsdc: 5,
    });
    const client = await createFundedClient(testClient, mockUsdcAddress, mockProvider);
    const stepOrder: string[] = [];

    const result = await client.requestService({
      providerUrl: mockProvider.providerUrl,
      serviceType: "test_service",
      description: "Step order test",
      budgetUsdc: 10,
      pollOptions: FAST_POLL_OPTIONS,
      onQuote: () => stepOrder.push("quote"),
      onPayment: () => stepOrder.push("payment"),
      onDelivered: () => stepOrder.push("delivered"),
      onConfirmed: () => stepOrder.push("confirmed"),
    });

    expect(stepOrder).toEqual(["quote", "payment", "delivered", "confirmed"]);
    expect(result.status).toBe("confirmed");
  });

  it("should verify deliverable content is received correctly", async () => {
    const mockProvider = createMockProvider({
      providerAddress: PROVIDER_ADDRESS,
      basePriceUsdc: 5,
    });
    const client = await createFundedClient(testClient, mockUsdcAddress, mockProvider);

    const result = await client.requestService({
      providerUrl: mockProvider.providerUrl,
      serviceType: "test_service",
      description: "Deliverable content test",
      budgetUsdc: 10,
      pollOptions: FAST_POLL_OPTIONS,
    });

    // Comprehensive deliverable assertions (Fix #6)
    expect(result.deliverable).toBeDefined();
    expect(result.deliverable.orderId).toBe(result.orderId);
    expect(result.deliverable.deliverable).toBeDefined();
    expect(result.deliverable.deliverable.type).toBe("test_result");
    expect(result.deliverable.deliverable.format).toBe("json");
    expect(result.deliverable.deliverable.content).toBeDefined();

    const content = result.deliverable.deliverable.content as Record<string, unknown>;
    expect(content.result).toBe("Integration test result");
    expect(content.orderId).toBe(result.orderId);

    // Verify provider agent info in deliverable envelope
    expect(result.deliverable.providerAgent).toBeDefined();
    expect(result.deliverable.providerAgent.walletAddress.toLowerCase()).toBe(
      PROVIDER_ADDRESS.toLowerCase(),
    );
  });

  it("should verify the payment transaction is on-chain", async () => {
    const mockProvider = createMockProvider({
      providerAddress: PROVIDER_ADDRESS,
      basePriceUsdc: 8,
    });
    const client = await createFundedClient(testClient, mockUsdcAddress, mockProvider);

    const result = await client.requestService({
      providerUrl: mockProvider.providerUrl,
      serviceType: "test_service",
      description: "Payment verification test",
      budgetUsdc: 15,
      pollOptions: FAST_POLL_OPTIONS,
    });

    const receipt = await testClient.getTransactionReceipt({
      hash: result.paymentTxHash,
    });
    expect(receipt.status).toBe("success");
  });

  it("should return delivered status when autoConfirm is false", async () => {
    const mockProvider = createMockProvider({
      providerAddress: PROVIDER_ADDRESS,
      basePriceUsdc: 5,
    });
    const client = await createFundedClient(testClient, mockUsdcAddress, mockProvider);

    const result = await client.requestService({
      providerUrl: mockProvider.providerUrl,
      serviceType: "test_service",
      description: "No auto-confirm test",
      budgetUsdc: 10,
      autoConfirm: false,
      pollOptions: FAST_POLL_OPTIONS,
    });

    expect(result.status).toBe("delivered");
    expect(result.confirmedAt).toBeUndefined();
    expect(result.deliverable).toBeDefined();
  });
});
