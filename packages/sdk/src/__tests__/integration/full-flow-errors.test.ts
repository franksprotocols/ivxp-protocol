/**
 * Integration tests: error scenarios (Story 3.11, AC #3)
 *
 * Tests that the SDK correctly handles errors at each step of the
 * requestService flow: input validation, budget checking, provider
 * rejection, delivery failure, and insufficient balance.
 *
 * Requires Anvil running on http://127.0.0.1:8545
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { TEST_ACCOUNTS, type AnvilTestClient } from "@ivxp/test-utils";
import {
  BudgetExceededError,
  ProviderError,
  InsufficientBalanceError,
} from "../../errors/specific.js";
import { IVXPError } from "../../errors/base.js";
import { IVXPClient, type IVXPClientConfig } from "../../core/client.js";
import {
  createTestPaymentService,
  createTestCryptoService,
  type IntegrationTestEnv,
} from "./setup.js";
import { createMockProvider } from "./mock-provider.js";
import {
  PROVIDER_ADDRESS,
  FAST_POLL_OPTIONS,
  createIntegrationClient,
  createFundedClient,
  initTestEnvironment,
} from "./full-flow-helpers.js";

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("error scenarios (AC #3)", () => {
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

  // -------------------------------------------------------------------------
  // Input validation errors
  // -------------------------------------------------------------------------

  it("should validate providerUrl and throw INVALID_PROVIDER_URL", async () => {
    const mockProvider = createMockProvider({
      providerAddress: PROVIDER_ADDRESS,
      basePriceUsdc: 5,
    });
    const client = createIntegrationClient(mockProvider, mockUsdcAddress);

    try {
      await client.requestService({
        providerUrl: "",
        serviceType: "test_service",
        description: "Invalid URL test",
        budgetUsdc: 10,
      });
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(IVXPError);
      expect((error as IVXPError).code).toBe("INVALID_PROVIDER_URL");
    }
  });

  it("should validate serviceType and throw INVALID_REQUEST_PARAMS", async () => {
    const mockProvider = createMockProvider({
      providerAddress: PROVIDER_ADDRESS,
      basePriceUsdc: 5,
    });
    const client = createIntegrationClient(mockProvider, mockUsdcAddress);

    try {
      await client.requestService({
        providerUrl: mockProvider.providerUrl,
        serviceType: "",
        description: "Empty service type test",
        budgetUsdc: 10,
      });
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(IVXPError);
      expect((error as IVXPError).code).toBe("INVALID_REQUEST_PARAMS");
    }
  });

  it("should validate budgetUsdc and throw INVALID_REQUEST_PARAMS for zero budget", async () => {
    const mockProvider = createMockProvider({
      providerAddress: PROVIDER_ADDRESS,
      basePriceUsdc: 5,
    });
    const client = createIntegrationClient(mockProvider, mockUsdcAddress);

    try {
      await client.requestService({
        providerUrl: mockProvider.providerUrl,
        serviceType: "test_service",
        description: "Zero budget test",
        budgetUsdc: 0,
      });
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(IVXPError);
      expect((error as IVXPError).code).toBe("INVALID_REQUEST_PARAMS");
    }
  });

  // -------------------------------------------------------------------------
  // Budget errors
  // -------------------------------------------------------------------------

  it("should throw BudgetExceededError when quote exceeds budget", async () => {
    const mockProvider = createMockProvider({
      providerAddress: PROVIDER_ADDRESS,
      basePriceUsdc: 100,
    });
    const client = createIntegrationClient(mockProvider, mockUsdcAddress);

    await expect(
      client.requestService({
        providerUrl: mockProvider.providerUrl,
        serviceType: "test_service",
        description: "Budget test",
        budgetUsdc: 10,
        pollOptions: { ...FAST_POLL_OPTIONS, maxAttempts: 5 },
      }),
    ).rejects.toThrow(BudgetExceededError);
  });

  it("should include quote info in BudgetExceededError", async () => {
    const mockProvider = createMockProvider({
      providerAddress: PROVIDER_ADDRESS,
      basePriceUsdc: 50,
    });
    const client = createIntegrationClient(mockProvider, mockUsdcAddress);

    try {
      await client.requestService({
        providerUrl: mockProvider.providerUrl,
        serviceType: "test_service",
        description: "Budget info test",
        budgetUsdc: 10,
        pollOptions: { ...FAST_POLL_OPTIONS, maxAttempts: 5 },
      });
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(BudgetExceededError);
      const budgetError = error as BudgetExceededError;
      expect(budgetError.budgetUsdc).toBe(10);
      expect(budgetError.quoteInfo.priceUsdc).toBe(50);
      expect(budgetError.quoteInfo.orderId).toMatch(/^ivxp-mock-/);
    }
  });

  // -------------------------------------------------------------------------
  // Provider errors
  // -------------------------------------------------------------------------

  it("should throw ProviderError when provider rejects requests", async () => {
    const mockProvider = createMockProvider({
      providerAddress: PROVIDER_ADDRESS,
      basePriceUsdc: 5,
      rejectRequests: true,
    });
    const client = createIntegrationClient(mockProvider, mockUsdcAddress);

    await expect(
      client.requestService({
        providerUrl: mockProvider.providerUrl,
        serviceType: "test_service",
        description: "Provider rejection test",
        budgetUsdc: 10,
        pollOptions: { ...FAST_POLL_OPTIONS, maxAttempts: 5 },
      }),
    ).rejects.toThrow(ProviderError);
  });

  it("should include step context in ProviderError for quote failure", async () => {
    const mockProvider = createMockProvider({
      providerAddress: PROVIDER_ADDRESS,
      basePriceUsdc: 5,
      rejectRequests: true,
    });
    const client = createIntegrationClient(mockProvider, mockUsdcAddress);

    try {
      await client.requestService({
        providerUrl: mockProvider.providerUrl,
        serviceType: "test_service",
        description: "Step context test",
        budgetUsdc: 10,
        pollOptions: { ...FAST_POLL_OPTIONS, maxAttempts: 5 },
      });
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderError);
      const providerError = error as ProviderError;
      expect(providerError.step).toBe("quote");
    }
  });

  // -------------------------------------------------------------------------
  // Delivery errors
  // -------------------------------------------------------------------------

  it("should throw IVXPError when delivery fails", async () => {
    const mockProvider = createMockProvider({
      providerAddress: PROVIDER_ADDRESS,
      basePriceUsdc: 5,
      failDelivery: true,
    });
    const client = await createFundedClient(testClient, mockUsdcAddress, mockProvider);

    await expect(
      client.requestService({
        providerUrl: mockProvider.providerUrl,
        serviceType: "test_service",
        description: "Delivery failure test",
        budgetUsdc: 10,
        pollOptions: FAST_POLL_OPTIONS,
      }),
    ).rejects.toThrow(IVXPError);
  });

  it("should throw IVXPError with DELIVERY_FAILED code when delivery fails", async () => {
    const mockProvider = createMockProvider({
      providerAddress: PROVIDER_ADDRESS,
      basePriceUsdc: 5,
      failDelivery: true,
    });
    const client = await createFundedClient(testClient, mockUsdcAddress, mockProvider);

    try {
      await client.requestService({
        providerUrl: mockProvider.providerUrl,
        serviceType: "test_service",
        description: "Delivery failure code test",
        budgetUsdc: 10,
        pollOptions: FAST_POLL_OPTIONS,
      });
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(IVXPError);
      expect((error as IVXPError).code).toBe("DELIVERY_FAILED");
    }
  });

  // -------------------------------------------------------------------------
  // Insufficient balance error (Fix #8)
  // -------------------------------------------------------------------------

  it("should throw InsufficientBalanceError when client has no USDC", async () => {
    // Use thirdParty account (never minted USDC) to guarantee zero balance
    const unfundedKey = TEST_ACCOUNTS.thirdParty.privateKey as `0x${string}`;

    const mockProvider = createMockProvider({
      providerAddress: PROVIDER_ADDRESS,
      basePriceUsdc: 5,
    });

    const unfundedConfig: IVXPClientConfig = {
      privateKey: unfundedKey,
      network: "base-sepolia",
      httpClient: mockProvider.httpClient,
      cryptoService: createTestCryptoService(unfundedKey),
      paymentService: createTestPaymentService(unfundedKey, mockUsdcAddress),
    };
    const client = new IVXPClient(unfundedConfig);

    await expect(
      client.requestService({
        providerUrl: mockProvider.providerUrl,
        serviceType: "test_service",
        description: "Insufficient balance test",
        budgetUsdc: 10,
        pollOptions: FAST_POLL_OPTIONS,
      }),
    ).rejects.toThrow(InsufficientBalanceError);
  });
});
