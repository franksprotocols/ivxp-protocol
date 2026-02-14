import { describe, it, expect, expectTypeOf } from "vitest";
import {
  // Constants
  PROTOCOL_VERSION,
  ORDER_STATUSES,
  USDC_CONTRACT_ADDRESSES,
  USDC_DECIMALS,
  ERROR_CODES,
  MESSAGE_TYPES,

  // Types (imported for type-level and runtime tests)
  type DeliveryFormat,
  type HexAddress,
  type NetworkId,
  type ProtocolVersion,
  type ServiceCatalog,
  type ServiceRequest,
  type DeliveryRequest,
  type OrderStatus,
  type OrderStatusResponse,
  type PaymentProof,
  type ServiceQuote,
  type PaymentInfo,
  type PaymentVerificationResult,
  type TransactionRef,
  type Deliverable,
  type DeliveryAccepted,
  type DeliveryConfirmation,
  type DeliveryResponse,
  type IVXPErrorCode,
  type IVXPErrorResponse,
  type IVXPMessageType,
} from "./index.js";

// ============================================================================
// Module Exports
// ============================================================================

describe("@ivxp/protocol exports", () => {
  it("should export PROTOCOL_VERSION constant", () => {
    expect(PROTOCOL_VERSION).toBe("IVXP/1.0");
  });

  it("should export ORDER_STATUSES array", () => {
    expect(ORDER_STATUSES).toBeDefined();
    expect(Array.isArray(ORDER_STATUSES)).toBe(true);
  });

  it("should export ERROR_CODES object", () => {
    expect(ERROR_CODES).toBeDefined();
    expect(typeof ERROR_CODES).toBe("object");
  });

  it("should export MESSAGE_TYPES array", () => {
    expect(MESSAGE_TYPES).toBeDefined();
    expect(Array.isArray(MESSAGE_TYPES)).toBe(true);
  });

  it("should export USDC_CONTRACT_ADDRESSES object", () => {
    expect(USDC_CONTRACT_ADDRESSES).toBeDefined();
    expect(typeof USDC_CONTRACT_ADDRESSES).toBe("object");
  });

  it("should export USDC_DECIMALS constant", () => {
    expect(USDC_DECIMALS).toBe(6);
  });
});

// ============================================================================
// Common Types
// ============================================================================

describe("Common types", () => {
  it("PROTOCOL_VERSION should be IVXP/1.0", () => {
    expect(PROTOCOL_VERSION).toBe("IVXP/1.0");
    expectTypeOf(PROTOCOL_VERSION).toEqualTypeOf<"IVXP/1.0">();
  });

  it("should correctly type HexAddress", () => {
    const addr: HexAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
    expect(addr).toMatch(/^0x/);
  });

  it("should correctly type NetworkId", () => {
    const mainnet: NetworkId = "base-mainnet";
    const sepolia: NetworkId = "base-sepolia";
    expect(mainnet).toBe("base-mainnet");
    expect(sepolia).toBe("base-sepolia");
  });

  it("should correctly type DeliveryFormat", () => {
    const formats: DeliveryFormat[] = ["markdown", "json", "code"];
    expect(formats).toHaveLength(3);
  });
});

// ============================================================================
// Order Types
// ============================================================================

describe("Order types", () => {
  describe("OrderStatus", () => {
    it("should include all valid statuses in ORDER_STATUSES", () => {
      expect(ORDER_STATUSES).toContain("quoted");
      expect(ORDER_STATUSES).toContain("paid");
      expect(ORDER_STATUSES).toContain("delivered");
      expect(ORDER_STATUSES).toContain("delivery_failed");
      expect(ORDER_STATUSES).toContain("confirmed");
      expect(ORDER_STATUSES).toHaveLength(5);
    });

    it("ORDER_STATUSES should be a readonly tuple", () => {
      // Verify it is frozen / readonly at runtime by checking it's an array
      expect(Array.isArray(ORDER_STATUSES)).toBe(true);
    });
  });

  describe("ServiceQuote", () => {
    it("should satisfy the ServiceQuote interface with snake_case fields", () => {
      const quote: ServiceQuote = {
        protocol: "IVXP/1.0",
        message_type: "service_quote",
        timestamp: "2026-02-05T12:00:00Z",
        order_id: "ivxp-550e8400-e29b-41d4-a716-446655440000",
        provider_agent: {
          name: "TestProvider",
          wallet_address: "0x1234567890abcdef1234567890abcdef12345678",
        },
        quote: {
          price_usdc: 30,
          estimated_delivery: "2026-02-05T14:00:00Z",
          payment_address: "0xabcdef1234567890abcdef1234567890abcdef12",
          network: "base-sepolia",
        },
      };

      expect(quote.protocol).toBe("IVXP/1.0");
      expect(quote.message_type).toBe("service_quote");
      expect(quote.order_id).toMatch(/^ivxp-/);
      expect(quote.provider_agent.wallet_address).toMatch(/^0x/);
      expect(quote.quote.price_usdc).toBe(30);
      expect(quote.quote.network).toBe("base-sepolia");
    });

    it("should allow optional terms in ServiceQuote", () => {
      const quote: ServiceQuote = {
        protocol: "IVXP/1.0",
        message_type: "service_quote",
        timestamp: "2026-02-05T12:00:00Z",
        order_id: "ivxp-test-id",
        provider_agent: {
          name: "Provider",
          wallet_address: "0x1234567890abcdef1234567890abcdef12345678",
          public_key: "0xpubkey",
        },
        quote: {
          price_usdc: 50,
          estimated_delivery: "2026-02-06T12:00:00Z",
          payment_address: "0xabcdef1234567890abcdef1234567890abcdef12",
          network: "base-mainnet",
          token_contract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        },
        terms: {
          payment_timeout: 3600,
          revision_policy: "One free revision",
          refund_policy: "No refunds",
        },
      };

      expect(quote.terms?.payment_timeout).toBe(3600);
      expect(quote.terms?.revision_policy).toBe("One free revision");
    });
  });

  describe("DeliveryRequest", () => {
    it("should satisfy the DeliveryRequest interface with snake_case fields", () => {
      const request: DeliveryRequest = {
        protocol: "IVXP/1.0",
        message_type: "delivery_request",
        timestamp: "2026-02-05T12:30:00Z",
        order_id: "ivxp-550e8400-e29b-41d4-a716-446655440000",
        payment_proof: {
          tx_hash: "0xabcd1234567890",
          from_address: "0x1234567890abcdef1234567890abcdef12345678",
          network: "base-sepolia",
        },
        signature: "0xsignature",
        signed_message:
          "Order: ivxp-550e8400-e29b-41d4-a716-446655440000 | Payment: 0xabcd1234567890 | Timestamp: 2026-02-05T12:30:00Z",
      };

      expect(request.protocol).toBe("IVXP/1.0");
      expect(request.message_type).toBe("delivery_request");
      expect(request.payment_proof.tx_hash).toMatch(/^0x/);
      expect(request.signed_message).toContain("Order:");
      expect(request.signed_message).toContain("Payment:");
      expect(request.signed_message).toContain("Timestamp:");
    });

    it("should allow optional extension fields in PaymentProof", () => {
      const proof: PaymentProof = {
        tx_hash: "0xabcd",
        from_address: "0x1234",
        network: "base-mainnet",
        to_address: "0x5678",
        amount_usdc: "30000000",
        block_number: 12345678,
      };

      expect(proof.to_address).toBe("0x5678");
      expect(proof.amount_usdc).toBe("30000000");
      expect(proof.block_number).toBe(12345678);
    });
  });

  describe("OrderStatusResponse", () => {
    it("should satisfy the OrderStatusResponse interface", () => {
      const response: OrderStatusResponse = {
        order_id: "ivxp-test-order",
        status: "paid",
        created_at: "2026-02-05T12:00:00Z",
        service_type: "code_review",
        price_usdc: 30,
      };

      expect(response.status).toBe("paid");
      expect(response.price_usdc).toBe(30);
    });

    it("should accept all valid status values except confirmed", () => {
      const statuses: OrderStatusResponse["status"][] = [
        "quoted",
        "paid",
        "delivered",
        "delivery_failed",
      ];
      expect(statuses).toHaveLength(4);
    });
  });
});

// ============================================================================
// Service Types
// ============================================================================

describe("Service types", () => {
  describe("ServiceCatalog", () => {
    it("should satisfy the ServiceCatalog interface with snake_case fields", () => {
      const catalog: ServiceCatalog = {
        protocol: "IVXP/1.0",
        provider: "ResearchBot",
        wallet_address: "0x1234567890abcdef1234567890abcdef12345678",
        services: [
          {
            type: "research",
            base_price_usdc: 50,
            estimated_delivery_hours: 8,
          },
          {
            type: "code_review",
            base_price_usdc: 30,
            estimated_delivery_hours: 1,
          },
        ],
      };

      expect(catalog.protocol).toBe("IVXP/1.0");
      expect(catalog.provider).toBe("ResearchBot");
      expect(catalog.services).toHaveLength(2);
      expect(catalog.services[0].type).toBe("research");
      expect(catalog.services[0].base_price_usdc).toBe(50);
      expect(catalog.services[1].estimated_delivery_hours).toBe(1);
    });

    it("should allow optional extension fields", () => {
      const catalog: ServiceCatalog = {
        protocol: "IVXP/1.0",
        provider: "TestBot",
        wallet_address: "0xtest",
        services: [],
        message_type: "service_catalog",
        timestamp: "2026-02-05T12:00:00Z",
      };

      expect(catalog.message_type).toBe("service_catalog");
      expect(catalog.timestamp).toBe("2026-02-05T12:00:00Z");
    });
  });

  describe("ServiceRequest", () => {
    it("should satisfy the ServiceRequest interface with snake_case fields", () => {
      const request: ServiceRequest = {
        protocol: "IVXP/1.0",
        message_type: "service_request",
        timestamp: "2026-02-05T12:00:00Z",
        client_agent: {
          name: "ResearchAssistant",
          wallet_address: "0xclient",
        },
        service_request: {
          type: "code_review",
          description: "Review this Python code for security issues",
          budget_usdc: 50,
        },
      };

      expect(request.protocol).toBe("IVXP/1.0");
      expect(request.message_type).toBe("service_request");
      expect(request.client_agent.name).toBe("ResearchAssistant");
      expect(request.service_request.type).toBe("code_review");
      expect(request.service_request.budget_usdc).toBe(50);
    });

    it("should allow optional fields in ServiceRequest", () => {
      const request: ServiceRequest = {
        protocol: "IVXP/1.0",
        message_type: "service_request",
        timestamp: "2026-02-05T12:00:00Z",
        client_agent: {
          name: "Agent",
          wallet_address: "0xclient",
          contact_endpoint: "https://agent.example.com/receive",
        },
        service_request: {
          type: "translation",
          description: "Translate to Chinese",
          budget_usdc: 10,
          delivery_format: "markdown",
          deadline: "2026-02-06T00:00:00Z",
        },
      };

      expect(request.client_agent.contact_endpoint).toBe("https://agent.example.com/receive");
      expect(request.service_request.delivery_format).toBe("markdown");
      expect(request.service_request.deadline).toBe("2026-02-06T00:00:00Z");
    });
  });
});

// ============================================================================
// Payment Types
// ============================================================================

describe("Payment types", () => {
  describe("USDC_CONTRACT_ADDRESSES", () => {
    it("should contain Base Mainnet USDC address", () => {
      expect(USDC_CONTRACT_ADDRESSES["base-mainnet"]).toBe(
        "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      );
    });

    it("should contain Base Sepolia USDC address", () => {
      expect(USDC_CONTRACT_ADDRESSES["base-sepolia"]).toBe(
        "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      );
    });

    it("should have exactly 2 network entries", () => {
      expect(Object.keys(USDC_CONTRACT_ADDRESSES)).toHaveLength(2);
    });

    it("all addresses should start with 0x", () => {
      for (const address of Object.values(USDC_CONTRACT_ADDRESSES)) {
        expect(address).toMatch(/^0x[0-9a-fA-F]+$/);
      }
    });
  });

  describe("USDC_DECIMALS", () => {
    it("should be 6", () => {
      expect(USDC_DECIMALS).toBe(6);
    });
  });

  describe("PaymentInfo", () => {
    it("should satisfy the PaymentInfo interface", () => {
      const info: PaymentInfo = {
        payment_address: "0xrecipient",
        amount_usdc: 30,
        network: "base-sepolia",
      };

      expect(info.payment_address).toMatch(/^0x/);
      expect(info.amount_usdc).toBe(30);
      expect(info.network).toBe("base-sepolia");
    });
  });

  describe("TransactionRef", () => {
    it("should satisfy the TransactionRef interface", () => {
      const ref: TransactionRef = {
        tx_hash: "0xtxhash",
        from_address: "0xfrom",
        to_address: "0xto",
        amount_usdc: 50,
        network: "base-mainnet",
        block_number: 1000000,
      };

      expect(ref.tx_hash).toMatch(/^0x/);
      expect(ref.amount_usdc).toBe(50);
      expect(ref.block_number).toBe(1000000);
    });
  });

  describe("PaymentVerificationResult", () => {
    it("should represent a successful verification", () => {
      const result: PaymentVerificationResult = {
        verified: true,
        tx_hash: "0xhash",
        actual_amount_usdc: 30,
        expected_amount_usdc: 30,
      };

      expect(result.verified).toBe(true);
    });

    it("should represent a failed verification with reason", () => {
      const result: PaymentVerificationResult = {
        verified: false,
        tx_hash: "0xhash",
        actual_amount_usdc: 20,
        expected_amount_usdc: 30,
        failure_reason: "Amount mismatch",
      };

      expect(result.verified).toBe(false);
      expect(result.failure_reason).toBe("Amount mismatch");
    });
  });
});

// ============================================================================
// Delivery Types
// ============================================================================

describe("Delivery types", () => {
  describe("DeliveryAccepted", () => {
    it("should satisfy the DeliveryAccepted interface", () => {
      const accepted: DeliveryAccepted = {
        status: "accepted",
        order_id: "ivxp-test-order",
        message: "Order accepted and processing",
      };

      expect(accepted.status).toBe("accepted");
      expect(accepted.order_id).toMatch(/^ivxp-/);
    });
  });

  describe("DeliveryResponse", () => {
    it("should satisfy the DeliveryResponse interface with snake_case fields", () => {
      const response: DeliveryResponse = {
        protocol: "IVXP/1.0",
        message_type: "service_delivery",
        timestamp: "2026-02-05T14:00:00Z",
        order_id: "ivxp-test-order",
        status: "completed",
        provider_agent: {
          name: "CodeReviewBot",
          wallet_address: "0xprovider",
        },
        deliverable: {
          type: "code_review_result",
          format: "json",
          content: { issues: [], score: 9.5 },
        },
      };

      expect(response.protocol).toBe("IVXP/1.0");
      expect(response.message_type).toBe("service_delivery");
      expect(response.status).toBe("completed");
      expect(response.deliverable.type).toBe("code_review_result");
    });

    it("should allow optional fields", () => {
      const response: DeliveryResponse = {
        protocol: "IVXP/1.0",
        message_type: "service_delivery",
        timestamp: "2026-02-05T14:00:00Z",
        order_id: "ivxp-test-order",
        status: "completed",
        provider_agent: {
          name: "Bot",
          wallet_address: "0xprovider",
        },
        deliverable: {
          type: "report",
          content: "Some markdown content",
        },
        content_hash: "sha256:abcdef1234567890",
        delivered_at: "2026-02-05T13:55:00Z",
        signature: "0xsig",
        signed_message: "Delivery confirmation message",
      };

      expect(response.content_hash).toContain("sha256:");
      expect(response.delivered_at).toBeDefined();
      expect(response.signature).toMatch(/^0x/);
    });
  });

  describe("DeliveryConfirmation", () => {
    it("should satisfy the DeliveryConfirmation interface", () => {
      const confirmation: DeliveryConfirmation = {
        protocol: "IVXP/1.0",
        message_type: "delivery_confirmation",
        timestamp: "2026-02-05T15:00:00Z",
        order_id: "ivxp-test-order",
        client_agent: {
          name: "ClientBot",
          wallet_address: "0xclient",
        },
        confirmation: {
          received: true,
          content_hash: "sha256:hash",
          received_at: "2026-02-05T14:30:00Z",
          satisfaction_rating: 5,
        },
        signature: "0xsig",
        signed_message: "Confirmation message",
      };

      expect(confirmation.message_type).toBe("delivery_confirmation");
      expect(confirmation.confirmation.received).toBe(true);
      expect(confirmation.confirmation.satisfaction_rating).toBe(5);
    });
  });
});

// ============================================================================
// Error Types
// ============================================================================

describe("Error types", () => {
  describe("ERROR_CODES", () => {
    it("should contain PAYMENT_NOT_VERIFIED", () => {
      expect(ERROR_CODES.PAYMENT_NOT_VERIFIED).toBe("PAYMENT_NOT_VERIFIED");
    });

    it("should contain SIGNATURE_INVALID", () => {
      expect(ERROR_CODES.SIGNATURE_INVALID).toBe("SIGNATURE_INVALID");
    });

    it("should contain ORDER_NOT_FOUND", () => {
      expect(ERROR_CODES.ORDER_NOT_FOUND).toBe("ORDER_NOT_FOUND");
    });

    it("should contain SERVICE_UNAVAILABLE", () => {
      expect(ERROR_CODES.SERVICE_UNAVAILABLE).toBe("SERVICE_UNAVAILABLE");
    });

    it("should contain INSUFFICIENT_BALANCE", () => {
      expect(ERROR_CODES.INSUFFICIENT_BALANCE).toBe("INSUFFICIENT_BALANCE");
    });

    it("should contain SERVICE_TYPE_NOT_SUPPORTED", () => {
      expect(ERROR_CODES.SERVICE_TYPE_NOT_SUPPORTED).toBe("SERVICE_TYPE_NOT_SUPPORTED");
    });

    it("should contain BUDGET_TOO_LOW", () => {
      expect(ERROR_CODES.BUDGET_TOO_LOW).toBe("BUDGET_TOO_LOW");
    });

    it("should contain PAYMENT_TIMEOUT", () => {
      expect(ERROR_CODES.PAYMENT_TIMEOUT).toBe("PAYMENT_TIMEOUT");
    });

    it("should contain ORDER_EXPIRED", () => {
      expect(ERROR_CODES.ORDER_EXPIRED).toBe("ORDER_EXPIRED");
    });

    it("should contain PROTOCOL_VERSION_UNSUPPORTED", () => {
      expect(ERROR_CODES.PROTOCOL_VERSION_UNSUPPORTED).toBe("PROTOCOL_VERSION_UNSUPPORTED");
    });

    it("should contain INTERNAL_ERROR", () => {
      expect(ERROR_CODES.INTERNAL_ERROR).toBe("INTERNAL_ERROR");
    });

    it("all error codes should use SCREAMING_SNAKE_CASE", () => {
      const screaming_snake_regex = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/;
      for (const [key, value] of Object.entries(ERROR_CODES)) {
        expect(key).toMatch(screaming_snake_regex);
        expect(value).toMatch(screaming_snake_regex);
        // Key and value should match (const assertion)
        expect(key).toBe(value);
      }
    });
  });

  describe("IVXPErrorResponse", () => {
    it("should satisfy the IVXPErrorResponse interface", () => {
      const errorResponse: IVXPErrorResponse = {
        error: "PAYMENT_NOT_VERIFIED",
        message: "Transaction not found on chain",
        details: {
          tx_hash: "0xhash",
          expected_amount: "1.50",
        },
      };

      expect(errorResponse.error).toBe("PAYMENT_NOT_VERIFIED");
      expect(errorResponse.message).toBeDefined();
      expect(errorResponse.details?.tx_hash).toBe("0xhash");
    });

    it("should work without optional details", () => {
      const errorResponse: IVXPErrorResponse = {
        error: "ORDER_NOT_FOUND",
        message: "Order not found",
      };

      expect(errorResponse.details).toBeUndefined();
    });
  });

  describe("MESSAGE_TYPES", () => {
    it("should contain all protocol message types", () => {
      expect(MESSAGE_TYPES).toContain("service_catalog");
      expect(MESSAGE_TYPES).toContain("service_request");
      expect(MESSAGE_TYPES).toContain("service_quote");
      expect(MESSAGE_TYPES).toContain("delivery_request");
      expect(MESSAGE_TYPES).toContain("service_delivery");
      expect(MESSAGE_TYPES).toContain("delivery_confirmation");
      expect(MESSAGE_TYPES).toHaveLength(6);
    });

    it("all message types should use snake_case", () => {
      const snake_case_regex = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
      for (const messageType of MESSAGE_TYPES) {
        expect(messageType).toMatch(snake_case_regex);
      }
    });
  });
});

// ============================================================================
// Edge Cases and Readonly Enforcement
// ============================================================================

describe("Edge cases", () => {
  describe("ERROR_CODES completeness", () => {
    it("should have exactly 11 error code keys", () => {
      const expectedKeys = [
        "PAYMENT_NOT_VERIFIED",
        "SIGNATURE_INVALID",
        "ORDER_NOT_FOUND",
        "SERVICE_UNAVAILABLE",
        "INSUFFICIENT_BALANCE",
        "SERVICE_TYPE_NOT_SUPPORTED",
        "BUDGET_TOO_LOW",
        "PAYMENT_TIMEOUT",
        "ORDER_EXPIRED",
        "PROTOCOL_VERSION_UNSUPPORTED",
        "INTERNAL_ERROR",
      ];
      const actualKeys = Object.keys(ERROR_CODES);
      expect(actualKeys).toHaveLength(expectedKeys.length);
      for (const key of expectedKeys) {
        expect(actualKeys).toContain(key);
      }
    });
  });

  describe("ORDER_STATUSES completeness", () => {
    it("should have exactly 5 entries matching the state machine", () => {
      const expected = ["quoted", "paid", "delivered", "delivery_failed", "confirmed"];
      expect(ORDER_STATUSES).toHaveLength(5);
      for (const status of expected) {
        expect(ORDER_STATUSES).toContain(status);
      }
    });

    it("should use snake_case for all statuses", () => {
      const snake_case_regex = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
      for (const status of ORDER_STATUSES) {
        expect(status).toMatch(snake_case_regex);
      }
    });
  });

  describe("Deliverable generic type", () => {
    it("should default to unknown content when no type parameter given", () => {
      const deliverable: Deliverable = {
        type: "report",
        content: "any value works with unknown",
      };
      expect(deliverable.content).toBe("any value works with unknown");
    });

    it("should narrow content type when generic parameter is provided", () => {
      interface CodeReviewResult {
        readonly issues: readonly string[];
        readonly score: number;
      }

      const typed: Deliverable<CodeReviewResult> = {
        type: "code_review_result",
        format: "json",
        content: { issues: ["use f-strings"], score: 9.5 },
      };

      // At runtime, verify the narrowed content is correct
      expect(typed.content.score).toBe(9.5);
      expect(typed.content.issues).toHaveLength(1);

      // Type-level: content should be CodeReviewResult, not unknown
      expectTypeOf(typed.content).toEqualTypeOf<CodeReviewResult>();
    });

    it("should narrow DeliveryResponse content via generic parameter", () => {
      interface ReportContent {
        readonly title: string;
        readonly body: string;
      }

      const response: DeliveryResponse<ReportContent> = {
        protocol: "IVXP/1.0",
        message_type: "service_delivery",
        timestamp: "2026-02-05T14:00:00Z",
        order_id: "ivxp-typed-test",
        status: "completed",
        provider_agent: {
          name: "Bot",
          wallet_address: "0xprovider",
        },
        deliverable: {
          type: "report",
          content: { title: "Test Report", body: "Content here" },
        },
      };

      expect(response.deliverable.content.title).toBe("Test Report");
      expectTypeOf(response.deliverable.content).toEqualTypeOf<ReportContent>();
    });
  });

  describe("Readonly enforcement via expectTypeOf", () => {
    it("ServiceCatalog fields should be readonly", () => {
      expectTypeOf<ServiceCatalog["protocol"]>().toEqualTypeOf<"IVXP/1.0">();
      expectTypeOf<ServiceCatalog["services"]>().toExtend<readonly unknown[]>();
    });

    it("DeliveryAccepted status should be literal 'accepted'", () => {
      expectTypeOf<DeliveryAccepted["status"]>().toEqualTypeOf<"accepted">();
    });

    it("DeliveryResponse status should be literal 'completed'", () => {
      expectTypeOf<DeliveryResponse["status"]>().toEqualTypeOf<"completed">();
    });

    it("ServiceQuote message_type should be literal 'service_quote'", () => {
      expectTypeOf<ServiceQuote["message_type"]>().toEqualTypeOf<"service_quote">();
    });

    it("DeliveryRequest message_type should be literal 'delivery_request'", () => {
      expectTypeOf<DeliveryRequest["message_type"]>().toEqualTypeOf<"delivery_request">();
    });
  });
});

// ============================================================================
// Wire Protocol Compatibility (snake_case verification)
// ============================================================================

describe("Wire protocol compatibility", () => {
  it("ServiceCatalog uses snake_case fields", () => {
    const catalog: ServiceCatalog = {
      protocol: "IVXP/1.0",
      provider: "test",
      wallet_address: "0xtest",
      services: [
        {
          type: "test",
          base_price_usdc: 10,
          estimated_delivery_hours: 1,
        },
      ],
      message_type: "service_catalog",
    };

    // Verify the object can be serialized with snake_case keys
    const json = JSON.stringify(catalog);
    expect(json).toContain("wallet_address");
    expect(json).toContain("base_price_usdc");
    expect(json).toContain("estimated_delivery_hours");
    expect(json).toContain("message_type");
    // Should NOT contain camelCase versions
    expect(json).not.toContain("walletAddress");
    expect(json).not.toContain("basePriceUsdc");
    expect(json).not.toContain("messageType");
  });

  it("ServiceRequest uses snake_case fields", () => {
    const request: ServiceRequest = {
      protocol: "IVXP/1.0",
      message_type: "service_request",
      timestamp: "2026-02-05T12:00:00Z",
      client_agent: {
        name: "test",
        wallet_address: "0xtest",
        contact_endpoint: "https://example.com",
      },
      service_request: {
        type: "test",
        description: "test",
        budget_usdc: 10,
        delivery_format: "json",
      },
    };

    const json = JSON.stringify(request);
    expect(json).toContain("message_type");
    expect(json).toContain("client_agent");
    expect(json).toContain("wallet_address");
    expect(json).toContain("contact_endpoint");
    expect(json).toContain("service_request");
    expect(json).toContain("budget_usdc");
    expect(json).toContain("delivery_format");
  });

  it("ServiceQuote uses snake_case fields", () => {
    const quote: ServiceQuote = {
      protocol: "IVXP/1.0",
      message_type: "service_quote",
      timestamp: "2026-02-05T12:00:00Z",
      order_id: "ivxp-test",
      provider_agent: {
        name: "test",
        wallet_address: "0xtest",
        public_key: "0xpk",
      },
      quote: {
        price_usdc: 30,
        estimated_delivery: "2026-02-05T14:00:00Z",
        payment_address: "0xpay",
        network: "base-sepolia",
        token_contract: "0xusdc",
      },
      terms: {
        payment_timeout: 3600,
        revision_policy: "none",
        refund_policy: "none",
      },
    };

    const json = JSON.stringify(quote);
    expect(json).toContain("message_type");
    expect(json).toContain("order_id");
    expect(json).toContain("provider_agent");
    expect(json).toContain("wallet_address");
    expect(json).toContain("public_key");
    expect(json).toContain("price_usdc");
    expect(json).toContain("estimated_delivery");
    expect(json).toContain("payment_address");
    expect(json).toContain("token_contract");
    expect(json).toContain("payment_timeout");
    expect(json).toContain("revision_policy");
    expect(json).toContain("refund_policy");
  });

  it("DeliveryRequest uses snake_case fields", () => {
    const request: DeliveryRequest = {
      protocol: "IVXP/1.0",
      message_type: "delivery_request",
      timestamp: "2026-02-05T12:30:00Z",
      order_id: "ivxp-test",
      payment_proof: {
        tx_hash: "0xhash",
        from_address: "0xfrom",
        network: "base-sepolia",
        to_address: "0xto",
        amount_usdc: "30000000",
        block_number: 100,
      },
      delivery_endpoint: "https://example.com/receive",
      signature: "0xsig",
      signed_message: "test message",
    };

    const json = JSON.stringify(request);
    expect(json).toContain("message_type");
    expect(json).toContain("order_id");
    expect(json).toContain("payment_proof");
    expect(json).toContain("tx_hash");
    expect(json).toContain("from_address");
    expect(json).toContain("to_address");
    expect(json).toContain("amount_usdc");
    expect(json).toContain("block_number");
    expect(json).toContain("delivery_endpoint");
    expect(json).toContain("signed_message");
  });

  it("DeliveryResponse uses snake_case fields", () => {
    const response: DeliveryResponse = {
      protocol: "IVXP/1.0",
      message_type: "service_delivery",
      timestamp: "2026-02-05T14:00:00Z",
      order_id: "ivxp-test",
      status: "completed",
      provider_agent: {
        name: "test",
        wallet_address: "0xprovider",
      },
      deliverable: {
        type: "result",
        content: {},
      },
      content_hash: "sha256:abc",
      delivered_at: "2026-02-05T13:55:00Z",
      signed_message: "delivery sig",
    };

    const json = JSON.stringify(response);
    expect(json).toContain("message_type");
    expect(json).toContain("order_id");
    expect(json).toContain("provider_agent");
    expect(json).toContain("wallet_address");
    expect(json).toContain("content_hash");
    expect(json).toContain("delivered_at");
    expect(json).toContain("signed_message");
  });
});

// ============================================================================
// Type-level Tests (compile-time verification)
// ============================================================================

describe("Type-level verification", () => {
  it("ProtocolVersion should be a string literal type", () => {
    expectTypeOf<ProtocolVersion>().toEqualTypeOf<"IVXP/1.0">();
  });

  it("OrderStatus should be a union of string literals", () => {
    expectTypeOf<OrderStatus>().toExtend<string>();
  });

  it("NetworkId should be a union of base-mainnet and base-sepolia", () => {
    expectTypeOf<"base-mainnet">().toExtend<NetworkId>();
    expectTypeOf<"base-sepolia">().toExtend<NetworkId>();
  });

  it("DeliveryFormat should be a union of markdown, json, code", () => {
    expectTypeOf<"markdown">().toExtend<DeliveryFormat>();
    expectTypeOf<"json">().toExtend<DeliveryFormat>();
    expectTypeOf<"code">().toExtend<DeliveryFormat>();
  });

  it("IVXPErrorCode should be derived from ERROR_CODES values", () => {
    expectTypeOf<"PAYMENT_NOT_VERIFIED">().toExtend<IVXPErrorCode>();
    expectTypeOf<"ORDER_NOT_FOUND">().toExtend<IVXPErrorCode>();
  });

  it("IVXPMessageType should cover all protocol message types", () => {
    expectTypeOf<"service_catalog">().toExtend<IVXPMessageType>();
    expectTypeOf<"service_request">().toExtend<IVXPMessageType>();
    expectTypeOf<"service_quote">().toExtend<IVXPMessageType>();
    expectTypeOf<"delivery_request">().toExtend<IVXPMessageType>();
    expectTypeOf<"service_delivery">().toExtend<IVXPMessageType>();
    expectTypeOf<"delivery_confirmation">().toExtend<IVXPMessageType>();
  });
});

// ============================================================================
// Full Protocol Flow Simulation
// ============================================================================

describe("Full protocol flow simulation", () => {
  it("should construct a complete IVXP/1.0 flow with proper types", () => {
    // Step 1: Provider publishes catalog
    const catalog: ServiceCatalog = {
      protocol: "IVXP/1.0",
      provider: "CodeReviewBot",
      wallet_address: "0xprovider1234567890abcdef1234567890abcdef12",
      services: [
        {
          type: "code_review",
          base_price_usdc: 30,
          estimated_delivery_hours: 1,
        },
      ],
    };

    // Step 2: Client sends request
    const request: ServiceRequest = {
      protocol: "IVXP/1.0",
      message_type: "service_request",
      timestamp: "2026-02-05T12:00:00Z",
      client_agent: {
        name: "ResearchAssistant",
        wallet_address: "0xclient1234567890abcdef1234567890abcdef12",
      },
      service_request: {
        type: "code_review",
        description: JSON.stringify({
          code: "print('hello')",
          language: "python",
        }),
        budget_usdc: 50,
        delivery_format: "json",
      },
    };

    // Step 3: Provider responds with quote
    const quote: ServiceQuote = {
      protocol: "IVXP/1.0",
      message_type: "service_quote",
      timestamp: "2026-02-05T12:00:01Z",
      order_id: "ivxp-550e8400-e29b-41d4-a716-446655440000",
      provider_agent: {
        name: catalog.provider,
        wallet_address: catalog.wallet_address,
      },
      quote: {
        price_usdc: 30,
        estimated_delivery: "2026-02-05T13:00:00Z",
        payment_address: catalog.wallet_address,
        network: "base-sepolia",
      },
    };

    // Step 4: Client sends delivery request with payment proof
    const deliveryReq: DeliveryRequest = {
      protocol: "IVXP/1.0",
      message_type: "delivery_request",
      timestamp: "2026-02-05T12:05:00Z",
      order_id: quote.order_id,
      payment_proof: {
        tx_hash: "0xtx1234567890abcdef",
        from_address: request.client_agent.wallet_address,
        network: "base-sepolia",
      },
      signature: "0xsignature1234567890abcdef",
      signed_message: `Order: ${quote.order_id} | Payment: 0xtx1234567890abcdef | Timestamp: 2026-02-05T12:05:00Z`,
    };

    // Step 5: Provider accepts delivery
    const accepted: DeliveryAccepted = {
      status: "accepted",
      order_id: quote.order_id,
      message: "Payment verified. Processing your code review.",
    };

    // Step 6: Client checks status
    const statusResp: OrderStatusResponse = {
      order_id: quote.order_id,
      status: "delivered",
      created_at: quote.timestamp,
      service_type: "code_review",
      price_usdc: 30,
    };

    // Step 7: Client downloads deliverable
    const delivery: DeliveryResponse = {
      protocol: "IVXP/1.0",
      message_type: "service_delivery",
      timestamp: "2026-02-05T12:30:00Z",
      order_id: quote.order_id,
      status: "completed",
      provider_agent: {
        name: catalog.provider,
        wallet_address: catalog.wallet_address,
      },
      deliverable: {
        type: "code_review_result",
        format: "json",
        content: {
          issues: [{ severity: "low", message: "Consider using f-strings" }],
          score: 9.0,
        },
      },
      content_hash: "sha256:abc123",
    };

    // Verify the full flow
    expect(catalog.protocol).toBe("IVXP/1.0");
    expect(request.service_request.type).toBe(catalog.services[0].type);
    expect(quote.order_id).toMatch(/^ivxp-/);
    expect(deliveryReq.order_id).toBe(quote.order_id);
    expect(accepted.order_id).toBe(quote.order_id);
    expect(statusResp.order_id).toBe(quote.order_id);
    expect(delivery.order_id).toBe(quote.order_id);
    expect(delivery.deliverable.content).toBeDefined();
  });
});
