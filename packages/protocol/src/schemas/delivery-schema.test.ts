/**
 * Unit tests for delivery Zod schemas.
 */

import { describe, expect, it } from "vitest";

import {
  DeliverableSchema,
  DeliveryAcceptedSchema,
  DeliveryConfirmationSchema,
  DeliveryProviderAgentSchema,
  DeliveryResponseSchema,
} from "./delivery-schema.js";

// ============================================================================
// Test Fixtures
// ============================================================================

const VALID_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const VALID_TIMESTAMP = "2026-02-05T12:00:00Z";
// EIP-191 signature: 0x + 130 hex chars (65 bytes)
const VALID_SIGNATURE = "0x" + "ab".repeat(65);

// ============================================================================
// DeliveryAcceptedSchema
// ============================================================================

describe("DeliveryAcceptedSchema", () => {
  it("should parse valid acceptance with camelCase transform", () => {
    const result = DeliveryAcceptedSchema.parse({
      status: "accepted",
      order_id: "ivxp-test-order",
      message: "Order accepted and processing",
    });

    expect(result.status).toBe("accepted");
    expect(result.orderId).toBe("ivxp-test-order");
    expect(result.message).toBe("Order accepted and processing");
    expect(result.streamUrl).toBeUndefined();
  });

  it("should parse optional stream_url", () => {
    const result = DeliveryAcceptedSchema.parse({
      status: "accepted",
      order_id: "ivxp-test-order",
      message: "Order accepted and processing",
      stream_url: "https://provider.test/ivxp/stream/ivxp-test-order",
    });

    expect(result.streamUrl).toBe("https://provider.test/ivxp/stream/ivxp-test-order");
  });

  it("should reject non-'accepted' status", () => {
    expect(() =>
      DeliveryAcceptedSchema.parse({
        status: "rejected",
        order_id: "ivxp-test",
        message: "Rejected",
      }),
    ).toThrow();
  });

  it("should reject missing order_id", () => {
    expect(() =>
      DeliveryAcceptedSchema.parse({
        status: "accepted",
        message: "test",
      }),
    ).toThrow();
  });

  it("should reject empty message", () => {
    expect(() =>
      DeliveryAcceptedSchema.parse({
        status: "accepted",
        order_id: "ivxp-test",
        message: "",
      }),
    ).toThrow();
  });

  it("should reject invalid stream_url", () => {
    expect(() =>
      DeliveryAcceptedSchema.parse({
        status: "accepted",
        order_id: "ivxp-test",
        message: "accepted",
        stream_url: "not-a-url",
      }),
    ).toThrow();
  });
});

// ============================================================================
// DeliverableSchema
// ============================================================================

describe("DeliverableSchema", () => {
  it("should parse valid deliverable with string content", () => {
    const result = DeliverableSchema.parse({
      type: "report",
      content: "Some markdown content",
    });

    expect(result.type).toBe("report");
    expect(result.content).toBe("Some markdown content");
    expect(result.format).toBeUndefined();
  });

  it("should parse deliverable with object content", () => {
    const result = DeliverableSchema.parse({
      type: "code_review_result",
      format: "json",
      content: { issues: ["use f-strings"], score: 9.5 },
    });

    expect(result.type).toBe("code_review_result");
    expect(result.format).toBe("json");
    expect(result.content).toEqual({ issues: ["use f-strings"], score: 9.5 });
  });

  it("should accept null content", () => {
    const result = DeliverableSchema.parse({
      type: "empty",
      content: null,
    });

    expect(result.content).toBeNull();
  });

  it("should accept array content", () => {
    const result = DeliverableSchema.parse({
      type: "list",
      content: [1, 2, 3],
    });

    expect(result.content).toEqual([1, 2, 3]);
  });

  it("should reject empty type", () => {
    expect(() => DeliverableSchema.parse({ type: "", content: "test" })).toThrow();
  });

  it("should reject missing type", () => {
    expect(() => DeliverableSchema.parse({ content: "test" })).toThrow();
  });
});

// ============================================================================
// DeliveryProviderAgentSchema
// ============================================================================

describe("DeliveryProviderAgentSchema", () => {
  it("should parse valid provider agent with camelCase transform", () => {
    const result = DeliveryProviderAgentSchema.parse({
      name: "CodeReviewBot",
      wallet_address: VALID_ADDRESS,
    });

    expect(result.name).toBe("CodeReviewBot");
    expect(result.walletAddress).toBe(VALID_ADDRESS.toLowerCase());
  });

  it("should reject invalid wallet_address", () => {
    expect(() =>
      DeliveryProviderAgentSchema.parse({
        name: "Bot",
        wallet_address: "invalid",
      }),
    ).toThrow();
  });

  it("should reject empty name", () => {
    expect(() =>
      DeliveryProviderAgentSchema.parse({
        name: "",
        wallet_address: VALID_ADDRESS,
      }),
    ).toThrow();
  });
});

// ============================================================================
// DeliveryResponseSchema
// ============================================================================

describe("DeliveryResponseSchema", () => {
  const validDeliveryResponse = {
    protocol: "IVXP/1.0",
    message_type: "service_delivery",
    timestamp: VALID_TIMESTAMP,
    order_id: "ivxp-test-order",
    status: "completed",
    provider_agent: {
      name: "CodeReviewBot",
      wallet_address: VALID_ADDRESS,
    },
    deliverable: {
      type: "code_review_result",
      format: "json",
      content: { issues: [], score: 9.5 },
    },
  };

  it("should parse valid delivery response with snake_case -> camelCase transform", () => {
    const result = DeliveryResponseSchema.parse(validDeliveryResponse);

    expect(result.protocol).toBe("IVXP/1.0");
    expect(result.messageType).toBe("service_delivery");
    expect(result.timestamp).toBe(VALID_TIMESTAMP);
    expect(result.orderId).toBe("ivxp-test-order");
    expect(result.status).toBe("completed");
    expect(result.providerAgent.name).toBe("CodeReviewBot");
    expect(result.providerAgent.walletAddress).toBe(VALID_ADDRESS.toLowerCase());
    expect(result.deliverable.type).toBe("code_review_result");
    expect(result.deliverable.format).toBe("json");
    expect(result.deliverable.content).toEqual({ issues: [], score: 9.5 });
    expect(result.contentHash).toBeUndefined();
    expect(result.deliveredAt).toBeUndefined();
    expect(result.signature).toBeUndefined();
    expect(result.signedMessage).toBeUndefined();
  });

  it("should include all optional fields", () => {
    const result = DeliveryResponseSchema.parse({
      ...validDeliveryResponse,
      content_hash: "sha256:abcdef1234567890",
      delivered_at: "2026-02-05T13:55:00Z",
      signature: VALID_SIGNATURE,
      signed_message: "Delivery confirmation message",
    });

    expect(result.contentHash).toBe("sha256:abcdef1234567890");
    expect(result.deliveredAt).toBe("2026-02-05T13:55:00Z");
    expect(result.signature).toBe(VALID_SIGNATURE);
    expect(result.signedMessage).toBe("Delivery confirmation message");
  });

  it("should reject wrong protocol version", () => {
    expect(() =>
      DeliveryResponseSchema.parse({
        ...validDeliveryResponse,
        protocol: "HTTP/1.1",
      }),
    ).toThrow();
  });

  it("should reject wrong message_type", () => {
    expect(() =>
      DeliveryResponseSchema.parse({
        ...validDeliveryResponse,
        message_type: "delivery_request",
      }),
    ).toThrow();
  });

  it("should reject non-'completed' status", () => {
    expect(() =>
      DeliveryResponseSchema.parse({
        ...validDeliveryResponse,
        status: "failed",
      }),
    ).toThrow();
  });

  it("should reject missing deliverable", () => {
    const { deliverable: _, ...withoutDeliverable } = validDeliveryResponse;
    expect(() => DeliveryResponseSchema.parse(withoutDeliverable)).toThrow();
  });

  it("should reject missing provider_agent", () => {
    const { provider_agent: _, ...withoutAgent } = validDeliveryResponse;
    expect(() => DeliveryResponseSchema.parse(withoutAgent)).toThrow();
  });

  it("should reject empty object", () => {
    expect(() => DeliveryResponseSchema.parse({})).toThrow();
  });
});

// ============================================================================
// DeliveryConfirmationSchema
// ============================================================================

describe("DeliveryConfirmationSchema", () => {
  const validConfirmation = {
    protocol: "IVXP/1.0",
    message_type: "delivery_confirmation",
    timestamp: VALID_TIMESTAMP,
    order_id: "ivxp-test-order",
    client_agent: {
      name: "ClientBot",
      wallet_address: VALID_ADDRESS,
    },
    confirmation: {
      received: true,
      content_hash: "sha256:hash123",
      received_at: "2026-02-05T14:30:00Z",
    },
    signature: VALID_SIGNATURE,
    signed_message: "Confirmation message",
  };

  it("should parse valid confirmation with snake_case -> camelCase transform", () => {
    const result = DeliveryConfirmationSchema.parse(validConfirmation);

    expect(result.protocol).toBe("IVXP/1.0");
    expect(result.messageType).toBe("delivery_confirmation");
    expect(result.timestamp).toBe(VALID_TIMESTAMP);
    expect(result.orderId).toBe("ivxp-test-order");
    expect(result.clientAgent.name).toBe("ClientBot");
    expect(result.clientAgent.walletAddress).toBe(VALID_ADDRESS.toLowerCase());
    expect(result.confirmation.received).toBe(true);
    expect(result.confirmation.contentHash).toBe("sha256:hash123");
    expect(result.confirmation.receivedAt).toBe("2026-02-05T14:30:00Z");
    expect(result.confirmation.satisfactionRating).toBeUndefined();
    expect(result.signature).toBe(VALID_SIGNATURE);
    expect(result.signedMessage).toBe("Confirmation message");
  });

  it("should include optional satisfaction_rating", () => {
    const result = DeliveryConfirmationSchema.parse({
      ...validConfirmation,
      confirmation: {
        ...validConfirmation.confirmation,
        satisfaction_rating: 5,
      },
    });

    expect(result.confirmation.satisfactionRating).toBe(5);
  });

  it("should reject satisfaction_rating outside 1-5 range", () => {
    expect(() =>
      DeliveryConfirmationSchema.parse({
        ...validConfirmation,
        confirmation: {
          ...validConfirmation.confirmation,
          satisfaction_rating: 0,
        },
      }),
    ).toThrow();

    expect(() =>
      DeliveryConfirmationSchema.parse({
        ...validConfirmation,
        confirmation: {
          ...validConfirmation.confirmation,
          satisfaction_rating: 6,
        },
      }),
    ).toThrow();
  });

  it("should reject non-integer satisfaction_rating", () => {
    expect(() =>
      DeliveryConfirmationSchema.parse({
        ...validConfirmation,
        confirmation: {
          ...validConfirmation.confirmation,
          satisfaction_rating: 3.5,
        },
      }),
    ).toThrow();
  });

  it("should reject wrong protocol", () => {
    expect(() =>
      DeliveryConfirmationSchema.parse({
        ...validConfirmation,
        protocol: "WRONG",
      }),
    ).toThrow();
  });

  it("should reject wrong message_type", () => {
    expect(() =>
      DeliveryConfirmationSchema.parse({
        ...validConfirmation,
        message_type: "service_delivery",
      }),
    ).toThrow();
  });

  it("should reject missing signature", () => {
    const { signature: _, ...withoutSig } = validConfirmation;
    expect(() => DeliveryConfirmationSchema.parse(withoutSig)).toThrow();
  });

  it("should reject missing confirmation", () => {
    const { confirmation: _, ...withoutConf } = validConfirmation;
    expect(() => DeliveryConfirmationSchema.parse(withoutConf)).toThrow();
  });

  it("should reject empty content_hash", () => {
    expect(() =>
      DeliveryConfirmationSchema.parse({
        ...validConfirmation,
        confirmation: {
          ...validConfirmation.confirmation,
          content_hash: "",
        },
      }),
    ).toThrow();
  });
});
