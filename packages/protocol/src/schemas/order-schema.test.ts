/**
 * Unit tests for order Zod schemas.
 */

import { describe, expect, it } from "vitest";

import {
  DeliveryRequestSchema,
  OrderStatusResponseSchema,
  PaymentProofSchema,
  ProviderAgentSchema,
  QuoteDetailsSchema,
  QuoteTermsSchema,
  ServiceQuoteSchema,
} from "./order-schema.js";

// ============================================================================
// Test Fixtures
// ============================================================================

const VALID_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const VALID_ADDRESS_2 = "0xabcdef1234567890abcdef1234567890abcdef12";
const VALID_TIMESTAMP = "2026-02-05T12:00:00Z";
// Transaction hash: 0x + 64 hex chars (32 bytes)
const VALID_TX_HASH = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
// EIP-191 signature: 0x + 130 hex chars (65 bytes)
const VALID_SIGNATURE = "0x" + "ab".repeat(65);

// ============================================================================
// ProviderAgentSchema
// ============================================================================

describe("ProviderAgentSchema", () => {
  it("should parse valid provider agent with camelCase transform", () => {
    const result = ProviderAgentSchema.parse({
      name: "TestProvider",
      wallet_address: VALID_ADDRESS,
    });

    expect(result.name).toBe("TestProvider");
    expect(result.walletAddress).toBe(VALID_ADDRESS.toLowerCase());
    expect(result.publicKey).toBeUndefined();
  });

  it("should include optional public_key", () => {
    const result = ProviderAgentSchema.parse({
      name: "TestProvider",
      wallet_address: VALID_ADDRESS,
      public_key: "0xabcd1234",
    });

    expect(result.publicKey).toBe("0xabcd1234");
  });

  it("should reject missing name", () => {
    expect(() => ProviderAgentSchema.parse({ wallet_address: VALID_ADDRESS })).toThrow();
  });

  it("should reject invalid wallet_address", () => {
    expect(() => ProviderAgentSchema.parse({ name: "Test", wallet_address: "invalid" })).toThrow();
  });
});

// ============================================================================
// QuoteDetailsSchema
// ============================================================================

describe("QuoteDetailsSchema", () => {
  it("should parse valid quote details with camelCase transform", () => {
    const result = QuoteDetailsSchema.parse({
      price_usdc: 30,
      estimated_delivery: VALID_TIMESTAMP,
      payment_address: VALID_ADDRESS,
      network: "base-sepolia",
    });

    expect(result.priceUsdc).toBe(30);
    expect(result.estimatedDelivery).toBe(VALID_TIMESTAMP);
    expect(result.paymentAddress).toBe(VALID_ADDRESS.toLowerCase());
    expect(result.network).toBe("base-sepolia");
    expect(result.tokenContract).toBeUndefined();
  });

  it("should include optional token_contract", () => {
    const result = QuoteDetailsSchema.parse({
      price_usdc: 50,
      estimated_delivery: VALID_TIMESTAMP,
      payment_address: VALID_ADDRESS,
      network: "base-mainnet",
      token_contract: VALID_ADDRESS_2,
    });

    expect(result.tokenContract).toBe(VALID_ADDRESS_2);
  });

  it("should reject non-positive price", () => {
    expect(() =>
      QuoteDetailsSchema.parse({
        price_usdc: 0,
        estimated_delivery: VALID_TIMESTAMP,
        payment_address: VALID_ADDRESS,
        network: "base-sepolia",
      }),
    ).toThrow();
  });
});

// ============================================================================
// QuoteTermsSchema
// ============================================================================

describe("QuoteTermsSchema", () => {
  it("should parse valid terms with camelCase transform", () => {
    const result = QuoteTermsSchema.parse({
      payment_timeout: 3600,
      revision_policy: "One free revision",
      refund_policy: "No refunds",
    });

    expect(result.paymentTimeout).toBe(3600);
    expect(result.revisionPolicy).toBe("One free revision");
    expect(result.refundPolicy).toBe("No refunds");
  });

  it("should allow all fields to be optional", () => {
    const result = QuoteTermsSchema.parse({});

    expect(result.paymentTimeout).toBeUndefined();
    expect(result.revisionPolicy).toBeUndefined();
    expect(result.refundPolicy).toBeUndefined();
  });
});

// ============================================================================
// ServiceQuoteSchema
// ============================================================================

describe("ServiceQuoteSchema", () => {
  const validQuote = {
    protocol: "IVXP/1.0",
    message_type: "service_quote",
    timestamp: VALID_TIMESTAMP,
    order_id: "ivxp-550e8400-e29b-41d4-a716-446655440000",
    provider_agent: {
      name: "TestProvider",
      wallet_address: VALID_ADDRESS,
    },
    quote: {
      price_usdc: 30,
      estimated_delivery: "2026-02-05T14:00:00Z",
      payment_address: VALID_ADDRESS_2,
      network: "base-sepolia",
    },
  };

  it("should parse valid quote with snake_case -> camelCase transform", () => {
    const result = ServiceQuoteSchema.parse(validQuote);

    expect(result.protocol).toBe("IVXP/1.0");
    expect(result.messageType).toBe("service_quote");
    expect(result.orderId).toBe("ivxp-550e8400-e29b-41d4-a716-446655440000");
    expect(result.providerAgent.walletAddress).toBe(VALID_ADDRESS.toLowerCase());
    expect(result.quote.priceUsdc).toBe(30);
    expect(result.quote.network).toBe("base-sepolia");
    expect(result.terms).toBeUndefined();
  });

  it("should include optional terms", () => {
    const result = ServiceQuoteSchema.parse({
      ...validQuote,
      terms: {
        payment_timeout: 3600,
        revision_policy: "One free revision",
        refund_policy: "No refunds",
      },
    });

    expect(result.terms?.paymentTimeout).toBe(3600);
    expect(result.terms?.revisionPolicy).toBe("One free revision");
    expect(result.terms?.refundPolicy).toBe("No refunds");
  });

  it("should reject wrong protocol version", () => {
    expect(() => ServiceQuoteSchema.parse({ ...validQuote, protocol: "IVXP/2.0" })).toThrow();
  });

  it("should reject wrong message_type", () => {
    expect(() =>
      ServiceQuoteSchema.parse({
        ...validQuote,
        message_type: "service_request",
      }),
    ).toThrow();
  });

  it("should reject missing order_id", () => {
    const { order_id: _, ...withoutOrderId } = validQuote;
    expect(() => ServiceQuoteSchema.parse(withoutOrderId)).toThrow();
  });

  it("should reject invalid provider_agent wallet_address", () => {
    expect(() =>
      ServiceQuoteSchema.parse({
        ...validQuote,
        provider_agent: { name: "Test", wallet_address: "invalid" },
      }),
    ).toThrow();
  });

  it("should reject empty object", () => {
    expect(() => ServiceQuoteSchema.parse({})).toThrow();
  });

  it("should reject null", () => {
    expect(() => ServiceQuoteSchema.parse(null)).toThrow();
  });
});

// ============================================================================
// PaymentProofSchema
// ============================================================================

describe("PaymentProofSchema", () => {
  it("should parse valid payment proof with camelCase transform", () => {
    const result = PaymentProofSchema.parse({
      tx_hash: VALID_TX_HASH,
      from_address: VALID_ADDRESS,
      network: "base-sepolia",
    });

    expect(result.txHash).toBe(VALID_TX_HASH);
    expect(result.fromAddress).toBe(VALID_ADDRESS.toLowerCase());
    expect(result.network).toBe("base-sepolia");
    expect(result.toAddress).toBeUndefined();
    expect(result.amountUsdc).toBeUndefined();
    expect(result.blockNumber).toBeUndefined();
  });

  it("should include optional extension fields", () => {
    const result = PaymentProofSchema.parse({
      tx_hash: VALID_TX_HASH,
      from_address: VALID_ADDRESS,
      network: "base-mainnet",
      to_address: VALID_ADDRESS_2,
      amount_usdc: "30000000",
      block_number: 12345678,
    });

    expect(result.toAddress).toBe(VALID_ADDRESS_2);
    expect(result.amountUsdc).toBe("30000000");
    expect(result.blockNumber).toBe(12345678);
  });

  it("should reject missing tx_hash", () => {
    expect(() =>
      PaymentProofSchema.parse({
        from_address: VALID_ADDRESS,
        network: "base-sepolia",
      }),
    ).toThrow();
  });
});

// ============================================================================
// DeliveryRequestSchema
// ============================================================================

describe("DeliveryRequestSchema", () => {
  const validDeliveryRequest = {
    protocol: "IVXP/1.0",
    message_type: "delivery_request",
    timestamp: VALID_TIMESTAMP,
    order_id: "ivxp-550e8400-e29b-41d4-a716-446655440000",
    payment_proof: {
      tx_hash: VALID_TX_HASH,
      from_address: VALID_ADDRESS,
      network: "base-sepolia",
    },
    signature: VALID_SIGNATURE,
    signed_message: "Order: ivxp-550e8400 | Payment: 0xabcd | Timestamp: 2026-02-05T12:30:00Z",
  };

  it("should parse valid delivery request with snake_case -> camelCase transform", () => {
    const result = DeliveryRequestSchema.parse(validDeliveryRequest);

    expect(result.protocol).toBe("IVXP/1.0");
    expect(result.messageType).toBe("delivery_request");
    expect(result.orderId).toBe("ivxp-550e8400-e29b-41d4-a716-446655440000");
    expect(result.paymentProof.txHash).toBe(VALID_TX_HASH);
    expect(result.paymentProof.fromAddress).toBe(VALID_ADDRESS.toLowerCase());
    expect(result.signature).toBe(VALID_SIGNATURE);
    expect(result.signedMessage).toContain("Order:");
    expect(result.deliveryEndpoint).toBeUndefined();
  });

  it("should include optional delivery_endpoint", () => {
    const result = DeliveryRequestSchema.parse({
      ...validDeliveryRequest,
      delivery_endpoint: "https://agent.example.com/receive",
    });

    expect(result.deliveryEndpoint).toBe("https://agent.example.com/receive");
  });

  it("should reject wrong protocol version", () => {
    expect(() =>
      DeliveryRequestSchema.parse({
        ...validDeliveryRequest,
        protocol: "HTTP/1.1",
      }),
    ).toThrow();
  });

  it("should reject wrong message_type", () => {
    expect(() =>
      DeliveryRequestSchema.parse({
        ...validDeliveryRequest,
        message_type: "service_quote",
      }),
    ).toThrow();
  });

  it("should reject missing signature", () => {
    const { signature: _, ...withoutSig } = validDeliveryRequest;
    expect(() => DeliveryRequestSchema.parse(withoutSig)).toThrow();
  });

  it("should reject missing signed_message", () => {
    const { signed_message: _, ...withoutMsg } = validDeliveryRequest;
    expect(() => DeliveryRequestSchema.parse(withoutMsg)).toThrow();
  });

  it("should reject invalid delivery_endpoint URL", () => {
    expect(() =>
      DeliveryRequestSchema.parse({
        ...validDeliveryRequest,
        delivery_endpoint: "not-a-url",
      }),
    ).toThrow();
  });
});

// ============================================================================
// OrderStatusResponseSchema
// ============================================================================

describe("OrderStatusResponseSchema", () => {
  const validStatusResponse = {
    order_id: "ivxp-test-order",
    status: "paid",
    created_at: VALID_TIMESTAMP,
    service_type: "code_review",
    price_usdc: 30,
  };

  it("should parse valid status response with camelCase transform", () => {
    const result = OrderStatusResponseSchema.parse(validStatusResponse);

    expect(result.orderId).toBe("ivxp-test-order");
    expect(result.status).toBe("paid");
    expect(result.createdAt).toBe(VALID_TIMESTAMP);
    expect(result.serviceType).toBe("code_review");
    expect(result.priceUsdc).toBe(30);
  });

  it("should accept all valid status values except confirmed", () => {
    const statuses = ["quoted", "paid", "delivered", "delivery_failed"] as const;

    for (const status of statuses) {
      const result = OrderStatusResponseSchema.parse({
        ...validStatusResponse,
        status,
      });
      expect(result.status).toBe(status);
    }
  });

  it("should reject 'confirmed' status in OrderStatusResponse", () => {
    expect(() =>
      OrderStatusResponseSchema.parse({
        ...validStatusResponse,
        status: "confirmed",
      }),
    ).toThrow();
  });

  it("should reject missing fields", () => {
    expect(() => OrderStatusResponseSchema.parse({})).toThrow();
    expect(() => OrderStatusResponseSchema.parse({ order_id: "test" })).toThrow();
  });
});
