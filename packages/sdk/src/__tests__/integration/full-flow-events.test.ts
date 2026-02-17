/**
 * Integration tests: event emission (Story 3.11, AC #2)
 *
 * Tests that the SDK emits the correct events during the requestService
 * flow. Uses timestamped event log entries for reliable ordering
 * verification (Fix #5).
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
// Types
// ---------------------------------------------------------------------------

/** A timestamped event log entry for reliable ordering. */
interface TimestampedEvent {
  readonly name: string;
  readonly timestamp: number;
  readonly payload: unknown;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("event emission (AC #2)", () => {
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

  it("should emit order.quoted event during requestService", async () => {
    const mockProvider = createMockProvider({
      providerAddress: PROVIDER_ADDRESS,
      basePriceUsdc: 5,
    });
    const client = await createFundedClient(testClient, mockUsdcAddress, mockProvider);
    const quotedEvents: Array<{ orderId: string; priceUsdc: string }> = [];

    client.on("order.quoted", (payload) => {
      quotedEvents.push(payload);
    });

    await client.requestService({
      providerUrl: mockProvider.providerUrl,
      serviceType: "test_service",
      description: "Event test",
      budgetUsdc: 10,
      pollOptions: FAST_POLL_OPTIONS,
    });

    expect(quotedEvents).toHaveLength(1);
    expect(quotedEvents[0].orderId).toMatch(/^ivxp-mock-/);
    expect(quotedEvents[0].priceUsdc).toBe("5");
  });

  it("should emit payment.sent event during requestService", async () => {
    const mockProvider = createMockProvider({
      providerAddress: PROVIDER_ADDRESS,
      basePriceUsdc: 5,
    });
    const client = await createFundedClient(testClient, mockUsdcAddress, mockProvider);
    const paymentSentEvents: Array<{ txHash: string }> = [];

    client.on("payment.sent", (payload) => {
      paymentSentEvents.push(payload);
    });

    await client.requestService({
      providerUrl: mockProvider.providerUrl,
      serviceType: "test_service",
      description: "Payment event test",
      budgetUsdc: 10,
      pollOptions: FAST_POLL_OPTIONS,
    });

    expect(paymentSentEvents).toHaveLength(1);
    expect(paymentSentEvents[0].txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });

  it("should emit order.delivered event during requestService", async () => {
    const mockProvider = createMockProvider({
      providerAddress: PROVIDER_ADDRESS,
      basePriceUsdc: 5,
    });
    const client = await createFundedClient(testClient, mockUsdcAddress, mockProvider);
    const deliveredEvents: Array<{ orderId: string; format: string }> = [];

    client.on("order.delivered", (payload) => {
      deliveredEvents.push(payload);
    });

    await client.requestService({
      providerUrl: mockProvider.providerUrl,
      serviceType: "test_service",
      description: "Delivery event test",
      budgetUsdc: 10,
      pollOptions: FAST_POLL_OPTIONS,
    });

    expect(deliveredEvents).toHaveLength(1);
    expect(deliveredEvents[0].orderId).toMatch(/^ivxp-mock-/);
  });

  it("should emit order.confirmed event during requestService", async () => {
    const mockProvider = createMockProvider({
      providerAddress: PROVIDER_ADDRESS,
      basePriceUsdc: 5,
    });
    const client = await createFundedClient(testClient, mockUsdcAddress, mockProvider);
    const confirmedEvents: Array<{ orderId: string; confirmedAt: string }> = [];

    client.on("order.confirmed", (payload) => {
      confirmedEvents.push(payload);
    });

    await client.requestService({
      providerUrl: mockProvider.providerUrl,
      serviceType: "test_service",
      description: "Confirmation event test",
      budgetUsdc: 10,
      pollOptions: FAST_POLL_OPTIONS,
    });

    expect(confirmedEvents).toHaveLength(1);
    expect(confirmedEvents[0].orderId).toMatch(/^ivxp-mock-/);
    expect(confirmedEvents[0].confirmedAt).toBeDefined();
  });

  it("should emit all events in correct order during full flow", async () => {
    const mockProvider = createMockProvider({
      providerAddress: PROVIDER_ADDRESS,
      basePriceUsdc: 5,
    });
    const client = await createFundedClient(testClient, mockUsdcAddress, mockProvider);

    // Use timestamped entries for reliable ordering (Fix #5)
    const eventLog: TimestampedEvent[] = [];
    let sequence = 0;

    const recordEvent = (name: string) => (payload: unknown) => {
      sequence += 1;
      eventLog.push({ name, timestamp: sequence, payload });
    };

    client.on("catalog.received", recordEvent("catalog.received"));
    client.on("order.quoted", recordEvent("order.quoted"));
    client.on("payment.sent", recordEvent("payment.sent"));
    client.on("order.paid", recordEvent("order.paid"));
    client.on("order.status_changed", recordEvent("order.status_changed"));
    client.on("order.delivered", recordEvent("order.delivered"));
    client.on("order.confirmed", recordEvent("order.confirmed"));

    await client.requestService({
      providerUrl: mockProvider.providerUrl,
      serviceType: "test_service",
      description: "Event order test",
      budgetUsdc: 10,
      pollOptions: FAST_POLL_OPTIONS,
    });

    // Extract event names in timestamp order
    const sortedNames = [...eventLog].sort((a, b) => a.timestamp - b.timestamp).map((e) => e.name);

    // Verify key events are present
    expect(sortedNames).toContain("order.quoted");
    expect(sortedNames).toContain("payment.sent");
    expect(sortedNames).toContain("order.paid");
    expect(sortedNames).toContain("order.delivered");
    expect(sortedNames).toContain("order.confirmed");

    // Verify ordering using timestamps (Fix #5: reliable via monotonic sequence)
    const getTimestamp = (name: string) => {
      const entry = eventLog.find((e) => e.name === name);
      if (!entry) {
        throw new Error(`Event ${name} not found in log`);
      }
      return entry.timestamp;
    };

    expect(getTimestamp("order.quoted")).toBeLessThan(getTimestamp("payment.sent"));
    expect(getTimestamp("payment.sent")).toBeLessThan(getTimestamp("order.paid"));
    expect(getTimestamp("order.paid")).toBeLessThan(getTimestamp("order.delivered"));
    expect(getTimestamp("order.delivered")).toBeLessThan(getTimestamp("order.confirmed"));
  });

  it("should NOT emit order.confirmed when autoConfirm is false", async () => {
    const mockProvider = createMockProvider({
      providerAddress: PROVIDER_ADDRESS,
      basePriceUsdc: 5,
    });
    const client = await createFundedClient(testClient, mockUsdcAddress, mockProvider);
    const eventNames: string[] = [];

    client.on("order.quoted", () => eventNames.push("order.quoted"));
    client.on("payment.sent", () => eventNames.push("payment.sent"));
    client.on("order.delivered", () => eventNames.push("order.delivered"));
    client.on("order.confirmed", () => eventNames.push("order.confirmed"));

    await client.requestService({
      providerUrl: mockProvider.providerUrl,
      serviceType: "test_service",
      description: "No confirm event test",
      budgetUsdc: 10,
      autoConfirm: false,
      pollOptions: FAST_POLL_OPTIONS,
    });

    expect(eventNames).toContain("order.quoted");
    expect(eventNames).toContain("payment.sent");
    expect(eventNames).toContain("order.delivered");
    expect(eventNames).not.toContain("order.confirmed");
  });
});
