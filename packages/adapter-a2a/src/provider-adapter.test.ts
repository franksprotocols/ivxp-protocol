import { describe, it, expect, vi, beforeEach } from "vitest";
import { IVXPA2AProviderAdapter } from "./provider-adapter.js";
import { IVXPProvider, IVXPError } from "@ivxp/sdk";
import type { DeliveryRequestOutput, ServiceRequestOutput } from "@ivxp/protocol";

// ---------------------------------------------------------------------------
// Mock IVXPProvider
// ---------------------------------------------------------------------------

vi.mock("@ivxp/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ivxp/sdk")>();
  return {
    ...actual,
    IVXPProvider: vi.fn(),
  };
});

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const MOCK_A2A_CONFIG = {
  privateKey: "0xdeadbeef" as `0x${string}`,
  network: "base-sepolia" as const,
};

const MOCK_PROVIDER_CONFIG = {
  privateKey: "0xdeadbeef" as `0x${string}`,
  services: [
    {
      type: "text_echo",
      base_price_usdc: 1,
      estimated_delivery_hours: 1,
    },
  ],
};

const MOCK_WIRE_CATALOG = {
  protocol: "IVXP/1.0",
  provider: "test-provider",
  wallet_address: "0x1234567890abcdef1234567890abcdef12345678",
  services: [{ type: "text_echo", base_price_usdc: 1, estimated_delivery_hours: 1 }],
  message_type: "service_catalog",
  timestamp: "2026-01-01T00:00:00Z",
};

const MOCK_WIRE_QUOTE = {
  protocol: "IVXP/1.0",
  message_type: "service_quote",
  timestamp: "2026-01-01T00:00:00Z",
  order_id: "ivxp-ord-1",
  provider_agent: {
    name: "test-provider",
    wallet_address: "0x1234567890abcdef1234567890abcdef12345678",
  },
  quote: {
    price_usdc: 1,
    estimated_delivery: "2026-01-02T00:00:00Z",
    payment_address: "0x1234567890abcdef1234567890abcdef12345678",
    network: "base-sepolia",
  },
};

const MOCK_WIRE_ACCEPTED = {
  status: "accepted" as const,
  order_id: "ivxp-ord-1",
  message: "Payment verified. Processing started.",
};

const MOCK_STORED_ORDER = {
  orderId: "ivxp-ord-1",
  status: "quoted" as const,
  clientAddress: "0xabcdef1234567890abcdef1234567890abcdef12" as `0x${string}`,
  serviceType: "text_echo",
  priceUsdc: "1.00",
  paymentAddress: "0x1234567890abcdef1234567890abcdef12345678" as `0x${string}`,
  network: "base-sepolia",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const MOCK_WIRE_DOWNLOAD = {
  order_id: "ivxp-ord-1",
  content: "Hello, World!",
  content_type: "text/plain",
  content_hash: "sha256:abc123",
};

function makeDeliverBody(
  overrides?: Partial<{
    nonce: string;
    timestamp: string;
  }>,
): DeliveryRequestOutput {
  const nonce = overrides?.nonce ?? "abc123def456";
  const ts = overrides?.timestamp ?? new Date().toISOString();
  return {
    protocol: "IVXP/1.0",
    messageType: "delivery_request",
    timestamp: ts,
    orderId: "ivxp-ord-1",
    paymentProof: {
      txHash: "0xabc123" as `0x${string}`,
      fromAddress: "0xabcdef1234567890abcdef1234567890abcdef12" as `0x${string}`,
      network: "base-sepolia",
      toAddress: undefined,
      amountUsdc: undefined,
      blockNumber: undefined,
    },
    deliveryEndpoint: undefined,
    signature: "0xsig123" as `0x${string}`,
    signedMessage: `IVXP-DELIVER | Order: ivxp-ord-1 | Payment: 0xabc123 | Nonce: ${nonce} | Timestamp: ${ts}`,
  };
}

function makeServiceRequestBody(): ServiceRequestOutput {
  return {
    protocol: "IVXP/1.0",
    messageType: "service_request",
    timestamp: new Date().toISOString(),
    clientAgent: {
      name: "test-client",
      walletAddress: "0xabcdef1234567890abcdef1234567890abcdef12" as `0x${string}`,
      contactEndpoint: undefined,
    },
    serviceRequest: {
      type: "text_echo",
      description: "test request",
      budgetUsdc: 5,
      deliveryFormat: undefined,
      deadline: undefined,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("IVXPA2AProviderAdapter", () => {
  let adapter: IVXPA2AProviderAdapter;
  let mockProviderInstance: {
    getCatalog: ReturnType<typeof vi.fn>;
    handleQuoteRequest: ReturnType<typeof vi.fn>;
    handleDeliveryRequest: ReturnType<typeof vi.fn>;
    handleStatusRequest: ReturnType<typeof vi.fn>;
    handleDownloadRequest: ReturnType<typeof vi.fn>;
    getOrder: ReturnType<typeof vi.fn>;
    getAddress: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockProviderInstance = {
      getCatalog: vi.fn(),
      handleQuoteRequest: vi.fn(),
      handleDeliveryRequest: vi.fn(),
      handleStatusRequest: vi.fn(),
      handleDownloadRequest: vi.fn(),
      getOrder: vi.fn(),
      getAddress: vi.fn().mockResolvedValue("0x1234567890abcdef1234567890abcdef12345678"),
    };
    vi.mocked(IVXPProvider).mockImplementation(() => mockProviderInstance as never);
    adapter = new IVXPA2AProviderAdapter(MOCK_A2A_CONFIG, MOCK_PROVIDER_CONFIG as never);
  });

  // -- handleCatalog --------------------------------------------------------

  describe("handleCatalog", () => {
    it("delegates to IVXPProvider.getCatalog and returns camelCase output", async () => {
      mockProviderInstance.getCatalog.mockResolvedValue(MOCK_WIRE_CATALOG);
      const result = await adapter.handleCatalog();
      expect(result.provider).toBe("test-provider");
      expect(result.walletAddress).toBe("0x1234567890abcdef1234567890abcdef12345678");
      expect(result.services[0].basePriceUsdc).toBe(1);
      expect(mockProviderInstance.getCatalog).toHaveBeenCalledOnce();
    });
  });

  // -- handleRequest --------------------------------------------------------

  describe("handleRequest", () => {
    it("delegates to IVXPProvider.handleQuoteRequest and returns camelCase output", async () => {
      mockProviderInstance.handleQuoteRequest.mockResolvedValue(MOCK_WIRE_QUOTE);
      const result = await adapter.handleRequest(makeServiceRequestBody());
      expect(result.orderId).toBe("ivxp-ord-1");
      expect(result.quote.priceUsdc).toBe(1);
      expect(mockProviderInstance.handleQuoteRequest).toHaveBeenCalledOnce();
    });
  });

  // -- handleDeliver --------------------------------------------------------

  describe("handleDeliver", () => {
    it("accepts valid delivery with fresh timestamp and unique nonce", async () => {
      mockProviderInstance.handleDeliveryRequest.mockResolvedValue(MOCK_WIRE_ACCEPTED);
      const result = await adapter.handleDeliver(makeDeliverBody());
      expect(result.status).toBe("accepted");
      expect(result.orderId).toBe("ivxp-ord-1");
      expect(mockProviderInstance.handleDeliveryRequest).toHaveBeenCalledOnce();
    });

    it("rejects stale timestamp (> 300s old)", async () => {
      const staleTs = new Date(Date.now() - 301_000).toISOString();
      await expect(adapter.handleDeliver(makeDeliverBody({ timestamp: staleTs }))).rejects.toThrow(
        "Timestamp too old or too far in future",
      );
      expect(mockProviderInstance.handleDeliveryRequest).not.toHaveBeenCalled();
    });

    it("rejects future timestamp (> 300s ahead)", async () => {
      const futureTs = new Date(Date.now() + 301_000).toISOString();
      await expect(adapter.handleDeliver(makeDeliverBody({ timestamp: futureTs }))).rejects.toThrow(
        "Timestamp too old or too far in future",
      );
      expect(mockProviderInstance.handleDeliveryRequest).not.toHaveBeenCalled();
    });

    it("accepts timestamp at exactly 300s boundary", async () => {
      mockProviderInstance.handleDeliveryRequest.mockResolvedValue(MOCK_WIRE_ACCEPTED);
      const boundaryTs = new Date(Date.now() - 300_000).toISOString();
      const result = await adapter.handleDeliver(makeDeliverBody({ timestamp: boundaryTs }));
      expect(result.status).toBe("accepted");
    });

    it("rejects timestamp at 300_001ms boundary", async () => {
      const overTs = new Date(Date.now() - 300_001).toISOString();
      await expect(adapter.handleDeliver(makeDeliverBody({ timestamp: overTs }))).rejects.toThrow(
        "Timestamp too old or too far in future",
      );
    });

    it("rejects when timestamp field is missing from signed message", async () => {
      const body = makeDeliverBody();
      const modifiedBody: DeliveryRequestOutput = {
        ...body,
        signedMessage: "IVXP-DELIVER | Order: ivxp-ord-1 | Payment: 0xabc123 | Nonce: abc123def456",
      };
      await expect(adapter.handleDeliver(modifiedBody)).rejects.toThrow(
        "Missing timestamp in signed message",
      );
      expect(mockProviderInstance.handleDeliveryRequest).not.toHaveBeenCalled();
    });

    it("rejects when nonce field is missing from signed message", async () => {
      const ts = new Date().toISOString();
      const body = makeDeliverBody({ timestamp: ts });
      const modifiedBody: DeliveryRequestOutput = {
        ...body,
        signedMessage: `IVXP-DELIVER | Order: ivxp-ord-1 | Payment: 0xabc123 | Timestamp: ${ts}`,
      };
      await expect(adapter.handleDeliver(modifiedBody)).rejects.toThrow(
        "Missing nonce in signed message",
      );
      expect(mockProviderInstance.handleDeliveryRequest).not.toHaveBeenCalled();
    });

    it("rejects duplicate nonce for same order", async () => {
      mockProviderInstance.handleDeliveryRequest.mockResolvedValue(MOCK_WIRE_ACCEPTED);
      await adapter.handleDeliver(makeDeliverBody({ nonce: "same-nonce" }));
      await expect(adapter.handleDeliver(makeDeliverBody({ nonce: "same-nonce" }))).rejects.toThrow(
        "Duplicate nonce",
      );
    });

    it("allows same nonce for different orders", async () => {
      mockProviderInstance.handleDeliveryRequest.mockResolvedValue(MOCK_WIRE_ACCEPTED);
      await adapter.handleDeliver(makeDeliverBody({ nonce: "shared-nonce" }));

      // Different order
      const differentOrderBody = makeDeliverBody({ nonce: "shared-nonce" });
      const modifiedBody: DeliveryRequestOutput = {
        ...differentOrderBody,
        orderId: "ivxp-ord-2",
        signedMessage: differentOrderBody.signedMessage.replace("ivxp-ord-1", "ivxp-ord-2"),
      };
      mockProviderInstance.handleDeliveryRequest.mockResolvedValue({
        ...MOCK_WIRE_ACCEPTED,
        order_id: "ivxp-ord-2",
      });
      const result = await adapter.handleDeliver(modifiedBody);
      expect(result.status).toBe("accepted");
    });

    // -- 6 on-chain payment check rejection paths --

    it("rejects when order not found (ORDER_NOT_FOUND)", async () => {
      mockProviderInstance.handleDeliveryRequest.mockRejectedValue(
        new IVXPError("Order not found: ivxp-ord-1", "ORDER_NOT_FOUND"),
      );
      await expect(adapter.handleDeliver(makeDeliverBody())).rejects.toThrow("Order not found");
    });

    it("rejects when order not in quoted status (INVALID_ORDER_STATUS)", async () => {
      mockProviderInstance.handleDeliveryRequest.mockRejectedValue(
        new IVXPError("Order not in quoted status: paid", "INVALID_ORDER_STATUS"),
      );
      await expect(adapter.handleDeliver(makeDeliverBody())).rejects.toThrow(
        "Order not in quoted status",
      );
    });

    it("rejects when signed message does not contain order_id (INVALID_SIGNED_MESSAGE)", async () => {
      mockProviderInstance.handleDeliveryRequest.mockRejectedValue(
        new IVXPError(
          "Invalid signed message: must contain the order_id",
          "INVALID_SIGNED_MESSAGE",
        ),
      );
      await expect(adapter.handleDeliver(makeDeliverBody())).rejects.toThrow(
        "Invalid signed message",
      );
    });

    it("rejects when payment network mismatches provider network (NETWORK_MISMATCH)", async () => {
      mockProviderInstance.handleDeliveryRequest.mockRejectedValue(
        new IVXPError("Network mismatch: expected base-sepolia, got ethereum", "NETWORK_MISMATCH"),
      );
      await expect(adapter.handleDeliver(makeDeliverBody())).rejects.toThrow("Network mismatch");
    });

    it("rejects when on-chain payment verification fails (PAYMENT_VERIFICATION_FAILED)", async () => {
      mockProviderInstance.handleDeliveryRequest.mockRejectedValue(
        new IVXPError("Payment verification failed", "PAYMENT_VERIFICATION_FAILED"),
      );
      await expect(adapter.handleDeliver(makeDeliverBody())).rejects.toThrow(
        "Payment verification failed",
      );
    });

    it("rejects when EIP-191 signature verification fails (SIGNATURE_VERIFICATION_FAILED)", async () => {
      mockProviderInstance.handleDeliveryRequest.mockRejectedValue(
        new IVXPError("Signature verification failed", "SIGNATURE_VERIFICATION_FAILED"),
      );
      await expect(adapter.handleDeliver(makeDeliverBody())).rejects.toThrow(
        "Signature verification failed",
      );
    });

    it("does not register nonce when on-chain checks fail", async () => {
      mockProviderInstance.handleDeliveryRequest.mockRejectedValue(
        new IVXPError("Payment verification failed", "PAYMENT_VERIFICATION_FAILED"),
      );
      await expect(
        adapter.handleDeliver(makeDeliverBody({ nonce: "fail-nonce" })),
      ).rejects.toThrow();

      // Same nonce should still be accepted on retry (not registered)
      mockProviderInstance.handleDeliveryRequest.mockResolvedValue(MOCK_WIRE_ACCEPTED);
      const result = await adapter.handleDeliver(makeDeliverBody({ nonce: "fail-nonce" }));
      expect(result.status).toBe("accepted");
    });
  });

  // -- handleStatus ---------------------------------------------------------

  describe("handleStatus", () => {
    it("returns order status from stored order", async () => {
      mockProviderInstance.getOrder.mockResolvedValue(MOCK_STORED_ORDER);
      const result = await adapter.handleStatus("ivxp-ord-1");
      expect(result.orderId).toBe("ivxp-ord-1");
      expect(result.status).toBe("quoted");
      expect(result.serviceType).toBe("text_echo");
      expect(result.priceUsdc).toBe(1);
      expect(result.createdAt).toBe("2026-01-01T00:00:00Z");
    });

    it("throws ORDER_NOT_FOUND when order does not exist", async () => {
      mockProviderInstance.getOrder.mockResolvedValue(null);
      await expect(adapter.handleStatus("ivxp-ord-999")).rejects.toThrow("Order not found");
    });

    it("throws when priceUsdc is not a valid number", async () => {
      mockProviderInstance.getOrder.mockResolvedValue({
        ...MOCK_STORED_ORDER,
        priceUsdc: "not-a-number",
      });
      await expect(adapter.handleStatus("ivxp-ord-1")).rejects.toThrow("Invalid price");
    });
  });

  // -- handleDownload -------------------------------------------------------

  describe("handleDownload", () => {
    it("returns DeliveryResponseOutput with content and content_hash", async () => {
      mockProviderInstance.handleDownloadRequest.mockResolvedValue(MOCK_WIRE_DOWNLOAD);
      const result = await adapter.handleDownload("ivxp-ord-1");
      expect(result.orderId).toBe("ivxp-ord-1");
      expect(result.status).toBe("completed");
      expect(result.deliverable.content).toBe("Hello, World!");
      expect(result.contentHash).toBe("sha256:abc123");
    });

    it("uses default provider name when not configured", async () => {
      mockProviderInstance.handleDownloadRequest.mockResolvedValue(MOCK_WIRE_DOWNLOAD);
      const result = await adapter.handleDownload("ivxp-ord-1");
      expect(result.providerAgent.name).toBe("a2a-provider");
    });

    it("uses custom provider name from config", async () => {
      const customAdapter = new IVXPA2AProviderAdapter(
        { ...MOCK_A2A_CONFIG, providerName: "my-custom-provider" },
        MOCK_PROVIDER_CONFIG as never,
      );
      mockProviderInstance.handleDownloadRequest.mockResolvedValue(MOCK_WIRE_DOWNLOAD);
      const result = await customAdapter.handleDownload("ivxp-ord-1");
      expect(result.providerAgent.name).toBe("my-custom-provider");
    });
  });

  // -- handleDownloadWithArtifact -------------------------------------------

  describe("handleDownloadWithArtifact", () => {
    it("returns A2A Artifact with content_hash in metadata (FR22)", async () => {
      mockProviderInstance.handleDownloadRequest.mockResolvedValue(MOCK_WIRE_DOWNLOAD);
      const { response, artifact } = await adapter.handleDownloadWithArtifact("ivxp-ord-1");

      expect(response.orderId).toBe("ivxp-ord-1");
      expect(artifact.artifactId).toBe("ivxp-deliverable-ivxp-ord-1");
      expect(artifact.name).toBe("ivxp-deliverable-ivxp-ord-1");
      expect(artifact.metadata?.content_hash).toBe("sha256:abc123");
      expect(artifact.parts).toHaveLength(1);
      expect(artifact.parts[0].kind).toBe("text");
    });
  });
});
