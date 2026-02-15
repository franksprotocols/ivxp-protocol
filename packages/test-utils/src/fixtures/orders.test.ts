/**
 * Tests for fixture factories.
 */

import { describe, expect, it, beforeEach } from "vitest";
import {
  createMockQuote,
  createMockOrder,
  createMockQuoteDetails,
  createMockProviderAgent,
  createMockPaymentProof,
  createMockDeliveryRequest,
  createMockOrderStatusResponse,
  generateOrderId,
  resetOrderCounter,
  DEFAULT_TX_HASH,
  DEFAULT_SIGNATURE,
} from "./orders.js";
import { TEST_ACCOUNTS } from "./wallets.js";

describe("order fixtures", () => {
  beforeEach(() => {
    resetOrderCounter();
  });

  describe("generateOrderId", () => {
    it("should generate unique IDs", () => {
      const id1 = generateOrderId();
      const id2 = generateOrderId();
      expect(id1).not.toBe(id2);
    });

    it("should start with 'ivxp-'", () => {
      const id = generateOrderId();
      expect(id).toMatch(/^ivxp-/);
    });

    it("should be deterministic after reset", () => {
      const id1 = generateOrderId();
      resetOrderCounter();
      const id2 = generateOrderId();
      expect(id1).toBe(id2);
    });

    it("should accept an explicit counter parameter", () => {
      const id = generateOrderId(42);
      expect(id).toMatch(/^ivxp-/);
      expect(id).toContain("2a"); // 42 in hex is 0x2a
    });

    it("should not advance internal counter when explicit counter is used", () => {
      const auto1 = generateOrderId();
      generateOrderId(999);
      const auto2 = generateOrderId();
      expect(auto1).not.toBe(auto2);
      // auto2 should follow auto1 sequentially, not jump to 1000
    });
  });

  describe("createMockQuote", () => {
    it("should create a valid service quote with defaults", () => {
      const quote = createMockQuote();
      expect(quote.protocol).toBe("IVXP/1.0");
      expect(quote.message_type).toBe("service_quote");
      expect(quote.timestamp).toBeDefined();
      expect(quote.order_id).toMatch(/^ivxp-/);
      expect(quote.provider_agent.name).toBe("TestProvider");
      expect(quote.provider_agent.wallet_address).toBe(TEST_ACCOUNTS.provider.address);
      expect(quote.quote.price_usdc).toBe(10);
      expect(quote.quote.network).toBe("base-sepolia");
    });

    it("should allow field overrides", () => {
      const quote = createMockQuote({
        order_id: "ivxp-custom-id",
        quote: {
          price_usdc: 50,
          estimated_delivery: "2026-01-01T00:00:00Z",
          payment_address: TEST_ACCOUNTS.client.address,
          network: "base-mainnet",
        },
      });
      expect(quote.order_id).toBe("ivxp-custom-id");
      expect(quote.quote.price_usdc).toBe(50);
      expect(quote.quote.network).toBe("base-mainnet");
    });
  });

  describe("createMockQuoteDetails", () => {
    it("should create valid quote details", () => {
      const details = createMockQuoteDetails();
      expect(details.price_usdc).toBe(10);
      expect(details.network).toBe("base-sepolia");
      expect(details.payment_address).toBe(TEST_ACCOUNTS.provider.address);
    });
  });

  describe("createMockProviderAgent", () => {
    it("should create a valid provider agent", () => {
      const agent = createMockProviderAgent();
      expect(agent.name).toBe("TestProvider");
      expect(agent.wallet_address).toBe(TEST_ACCOUNTS.provider.address);
    });

    it("should allow overrides", () => {
      const agent = createMockProviderAgent({ name: "CustomProvider" });
      expect(agent.name).toBe("CustomProvider");
    });
  });

  describe("createMockOrder", () => {
    it("should create a quoted order by default", () => {
      const order = createMockOrder();
      expect(order.status).toBe("quoted");
      expect(order.clientAddress).toBe(TEST_ACCOUNTS.client.address);
      expect(order.paymentAddress).toBe(TEST_ACCOUNTS.provider.address);
      expect(order.serviceType).toBe("code_review");
      expect(order.priceUsdc).toBe("10.000000");
      expect(order.network).toBe("base-sepolia");
      expect(order.txHash).toBeUndefined();
    });

    it("should include txHash for non-quoted statuses", () => {
      const paid = createMockOrder("paid");
      expect(paid.status).toBe("paid");
      expect(paid.txHash).toBe(DEFAULT_TX_HASH);

      const delivered = createMockOrder("delivered");
      expect(delivered.txHash).toBe(DEFAULT_TX_HASH);
    });

    it("should allow field overrides", () => {
      const order = createMockOrder("quoted", {
        serviceType: "translation",
        priceUsdc: "25.000000",
      });
      expect(order.serviceType).toBe("translation");
      expect(order.priceUsdc).toBe("25.000000");
    });
  });

  describe("createMockPaymentProof", () => {
    it("should create a valid payment proof", () => {
      const proof = createMockPaymentProof();
      expect(proof.tx_hash).toBe(DEFAULT_TX_HASH);
      expect(proof.from_address).toBe(TEST_ACCOUNTS.client.address);
      expect(proof.network).toBe("base-sepolia");
    });
  });

  describe("createMockDeliveryRequest", () => {
    it("should create a valid delivery request", () => {
      const request = createMockDeliveryRequest();
      expect(request.protocol).toBe("IVXP/1.0");
      expect(request.message_type).toBe("delivery_request");
      expect(request.order_id).toMatch(/^ivxp-/);
      expect(request.signature).toBeDefined();
      expect(request.signed_message).toContain("Order:");
      expect(request.signed_message).toContain("Payment:");
    });
  });

  describe("createMockOrderStatusResponse", () => {
    it("should create a valid status response", () => {
      const response = createMockOrderStatusResponse("paid");
      expect(response.status).toBe("paid");
      expect(response.service_type).toBe("code_review");
      expect(response.price_usdc).toBe(10);
    });
  });

  describe("constants", () => {
    it("should export DEFAULT_TX_HASH as a 66-char hex string", () => {
      expect(DEFAULT_TX_HASH).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it("should export DEFAULT_SIGNATURE as a hex string", () => {
      expect(DEFAULT_SIGNATURE).toMatch(/^0x[0-9a-f]+$/);
    });
  });
});
