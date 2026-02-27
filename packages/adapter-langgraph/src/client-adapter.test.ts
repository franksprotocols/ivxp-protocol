import { describe, it, expect, vi, beforeEach } from "vitest";
import { IVXPLangGraphClientAdapter } from "./client-adapter.js";
import { toLangGraphError } from "./errors.js";
import { IVXPError } from "@ivxp/sdk";
import type { IVXPClient } from "@ivxp/sdk";
import type { IHttpClient } from "@ivxp/protocol";

// -- Mock data ----------------------------------------------------------------

const MOCK_CATALOG = { provider: "test-provider", services: [] };
const MOCK_QUOTE = { orderId: "ord-1", priceUsdc: 1, expiresAt: "2026-01-01T00:00:00Z" };
const MOCK_ORDER_STATUS = { orderId: "ord-1", status: "completed" as const };
const MOCK_DELIVERABLE = {
  orderId: "ord-1",
  content: "Hello",
  contentType: "text/plain",
  contentHash: "abc123",
};

const MOCK_PAYMENT_PROOF = {
  txHash: "0xabc" as `0x${string}`,
  fromAddress: "0x111" as `0x${string}`,
  network: "base-sepolia",
};
const MOCK_SIGNATURE = "0xsig" as `0x${string}`;
const MOCK_SIGNED_MESSAGE = "IVXP-DELIVER | Order: ord-1 | ...";

const PROVIDER_URL = "https://provider.example.com";

const MOCK_DELIVERY_ACCEPTED_WIRE = {
  protocol: "IVXP/1.0",
  message_type: "delivery_accepted",
  timestamp: "2026-01-01T00:00:00Z",
  order_id: "ord-1",
  status: "accepted",
  message: "OK",
};

// -- Test suite ---------------------------------------------------------------

describe("IVXPLangGraphClientAdapter", () => {
  let adapter: IVXPLangGraphClientAdapter;
  let mockClient: {
    getCatalog: ReturnType<typeof vi.fn>;
    requestQuote: ReturnType<typeof vi.fn>;
    getOrderStatus: ReturnType<typeof vi.fn>;
    downloadDeliverable: ReturnType<typeof vi.fn>;
  };
  let mockHttpClient: { post: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockClient = {
      getCatalog: vi.fn(),
      requestQuote: vi.fn(),
      getOrderStatus: vi.fn(),
      downloadDeliverable: vi.fn(),
    };
    mockHttpClient = { post: vi.fn() };
    adapter = new IVXPLangGraphClientAdapter(
      mockClient as unknown as IVXPClient,
      mockHttpClient as unknown as IHttpClient,
    );
  });

  // -- getCatalog -------------------------------------------------------------

  describe("getCatalog", () => {
    it("delegates to IVXPClient.getCatalog and returns catalog", async () => {
      mockClient.getCatalog.mockResolvedValue(MOCK_CATALOG);
      const result = await adapter.getCatalog(PROVIDER_URL);
      expect(result).toEqual(MOCK_CATALOG);
      expect(mockClient.getCatalog).toHaveBeenCalledWith(PROVIDER_URL);
    });

    it("converts IVXPError to plain Error", async () => {
      const ivxpErr = new IVXPError("not found", "CATALOG_NOT_FOUND");
      mockClient.getCatalog.mockRejectedValue(ivxpErr);
      await expect(adapter.getCatalog(PROVIDER_URL)).rejects.toSatisfy((err: Error) => {
        expect(err).toBeInstanceOf(Error);
        expect(err).not.toBeInstanceOf(IVXPError);
        expect(err.message).toContain("IVXP:CATALOG_NOT_FOUND");
        expect(err.message).toContain("getCatalog failed");
        expect(err.cause).toBe(ivxpErr);
        return true;
      });
    });

    it("passes non-IVXPError errors through as-is", async () => {
      const plainErr = new Error("network timeout");
      mockClient.getCatalog.mockRejectedValue(plainErr);
      await expect(adapter.getCatalog(PROVIDER_URL)).rejects.toBe(plainErr);
    });
  });

  // -- requestQuote -----------------------------------------------------------

  describe("requestQuote", () => {
    const params = { serviceType: "text_echo", description: "test", budgetUsdc: 5 };

    it("delegates to IVXPClient.requestQuote and returns quote", async () => {
      mockClient.requestQuote.mockResolvedValue(MOCK_QUOTE);
      const result = await adapter.requestQuote(PROVIDER_URL, params);
      expect(result).toEqual(MOCK_QUOTE);
      expect(mockClient.requestQuote).toHaveBeenCalledWith(PROVIDER_URL, params);
    });

    it("converts IVXPError to plain Error", async () => {
      const ivxpErr = new IVXPError("bad params", "INVALID_REQUEST_PARAMS");
      mockClient.requestQuote.mockRejectedValue(ivxpErr);
      await expect(adapter.requestQuote(PROVIDER_URL, params)).rejects.toSatisfy((err: Error) => {
        expect(err).not.toBeInstanceOf(IVXPError);
        expect(err.message).toContain("IVXP:INVALID_REQUEST_PARAMS");
        expect(err.message).toContain("requestQuote failed");
        expect(err.cause).toBe(ivxpErr);
        return true;
      });
    });

    it("passes non-IVXPError errors through as-is", async () => {
      const plainErr = new Error("timeout");
      mockClient.requestQuote.mockRejectedValue(plainErr);
      await expect(adapter.requestQuote(PROVIDER_URL, params)).rejects.toBe(plainErr);
    });
  });

  // -- requestDelivery --------------------------------------------------------

  describe("requestDelivery", () => {
    it("posts to correct URL with correct body and returns parsed response", async () => {
      mockHttpClient.post.mockResolvedValue(MOCK_DELIVERY_ACCEPTED_WIRE);
      const result = await adapter.requestDelivery(
        PROVIDER_URL,
        "ord-1",
        MOCK_PAYMENT_PROOF as any,
        MOCK_SIGNATURE,
        MOCK_SIGNED_MESSAGE,
      );
      expect(result.orderId).toBe("ord-1");
      expect(result.status).toBe("accepted");
      expect(mockHttpClient.post).toHaveBeenCalledOnce();
      const [url, body] = mockHttpClient.post.mock.calls[0] as [string, Record<string, unknown>];
      expect(url).toBe("https://provider.example.com/ivxp/deliver");
      expect(body.protocol).toBe("IVXP/1.0");
      expect(body.message_type).toBe("delivery_request");
      expect(body.order_id).toBe("ord-1");
      expect(body.signature).toBe(MOCK_SIGNATURE);
      expect(body.signed_message).toBe(MOCK_SIGNED_MESSAGE);
      const proof = body.payment_proof as Record<string, unknown>;
      expect(proof.tx_hash).toBe("0xabc");
      expect(proof.from_address).toBe("0x111");
      expect(proof.network).toBe("base-sepolia");
    });

    it("strips trailing slashes from providerUrl before constructing deliverUrl", async () => {
      mockHttpClient.post.mockResolvedValue(MOCK_DELIVERY_ACCEPTED_WIRE);
      await adapter.requestDelivery(
        "https://provider.example.com///",
        "ord-1",
        MOCK_PAYMENT_PROOF as any,
        MOCK_SIGNATURE,
        MOCK_SIGNED_MESSAGE,
      );
      const [url] = mockHttpClient.post.mock.calls[0] as [string];
      expect(url).toBe("https://provider.example.com/ivxp/deliver");
    });

    it("includes optional payment proof fields when present", async () => {
      mockHttpClient.post.mockResolvedValue(MOCK_DELIVERY_ACCEPTED_WIRE);
      const fullProof = {
        ...MOCK_PAYMENT_PROOF,
        toAddress: "0x222" as `0x${string}`,
        amountUsdc: "5.00",
        blockNumber: 12345,
      };
      await adapter.requestDelivery(
        PROVIDER_URL,
        "ord-1",
        fullProof as any,
        MOCK_SIGNATURE,
        MOCK_SIGNED_MESSAGE,
      );
      const [, body] = mockHttpClient.post.mock.calls[0] as [string, Record<string, unknown>];
      const proof = body.payment_proof as Record<string, unknown>;
      expect(proof.to_address).toBe("0x222");
      expect(proof.amount_usdc).toBe("5.00");
      expect(proof.block_number).toBe(12345);
    });

    it("omits optional payment proof fields when absent", async () => {
      mockHttpClient.post.mockResolvedValue(MOCK_DELIVERY_ACCEPTED_WIRE);
      await adapter.requestDelivery(
        PROVIDER_URL,
        "ord-1",
        MOCK_PAYMENT_PROOF as any,
        MOCK_SIGNATURE,
        MOCK_SIGNED_MESSAGE,
      );
      const [, body] = mockHttpClient.post.mock.calls[0] as [string, Record<string, unknown>];
      const proof = body.payment_proof as Record<string, unknown>;
      expect(proof).not.toHaveProperty("to_address");
      expect(proof).not.toHaveProperty("amount_usdc");
      expect(proof).not.toHaveProperty("block_number");
    });

    it("converts IVXPError to plain Error with cause", async () => {
      const ivxpErr = new IVXPError("payment invalid", "PAYMENT_FAILED");
      mockHttpClient.post.mockRejectedValue(ivxpErr);
      await expect(
        adapter.requestDelivery(
          PROVIDER_URL,
          "ord-1",
          MOCK_PAYMENT_PROOF as any,
          MOCK_SIGNATURE,
          MOCK_SIGNED_MESSAGE,
        ),
      ).rejects.toSatisfy((err: Error) => {
        expect(err).not.toBeInstanceOf(IVXPError);
        expect(err.message).toContain("IVXP:PAYMENT_FAILED");
        expect(err.message).toContain("requestDelivery failed");
        expect(err.cause).toBe(ivxpErr);
        return true;
      });
    });

    it("passes non-IVXPError errors through as-is", async () => {
      const plainErr = new Error("connection refused");
      mockHttpClient.post.mockRejectedValue(plainErr);
      await expect(
        adapter.requestDelivery(
          PROVIDER_URL,
          "ord-1",
          MOCK_PAYMENT_PROOF as any,
          MOCK_SIGNATURE,
          MOCK_SIGNED_MESSAGE,
        ),
      ).rejects.toBe(plainErr);
    });

    it("wraps ZodError as INVALID_RESPONSE error", async () => {
      mockHttpClient.post.mockResolvedValue({ invalid: "response" });
      await expect(
        adapter.requestDelivery(
          PROVIDER_URL,
          "ord-1",
          MOCK_PAYMENT_PROOF as any,
          MOCK_SIGNATURE,
          MOCK_SIGNED_MESSAGE,
        ),
      ).rejects.toSatisfy((err: Error) => {
        expect(err.message).toContain("IVXP:INVALID_RESPONSE");
        expect(err.message).toContain("requestDelivery failed");
        return true;
      });
    });

    it("throws converted error for invalid providerUrl", async () => {
      await expect(
        adapter.requestDelivery(
          "not-a-url",
          "ord-1",
          MOCK_PAYMENT_PROOF as any,
          MOCK_SIGNATURE,
          MOCK_SIGNED_MESSAGE,
        ),
      ).rejects.toSatisfy((err: Error) => {
        expect(err).not.toBeInstanceOf(IVXPError);
        expect(err.message).toContain("IVXP:INVALID_PROVIDER_URL");
        return true;
      });
    });
  });

  // -- getStatus --------------------------------------------------------------

  describe("getStatus", () => {
    it("delegates to IVXPClient.getOrderStatus and returns status", async () => {
      mockClient.getOrderStatus.mockResolvedValue(MOCK_ORDER_STATUS);
      const result = await adapter.getStatus(PROVIDER_URL, "ord-1");
      expect(result).toEqual(MOCK_ORDER_STATUS);
      expect(mockClient.getOrderStatus).toHaveBeenCalledWith(PROVIDER_URL, "ord-1");
    });

    it("converts IVXPError to plain Error", async () => {
      const ivxpErr = new IVXPError("order not found", "ORDER_NOT_FOUND");
      mockClient.getOrderStatus.mockRejectedValue(ivxpErr);
      await expect(adapter.getStatus(PROVIDER_URL, "ord-1")).rejects.toSatisfy((err: Error) => {
        expect(err).not.toBeInstanceOf(IVXPError);
        expect(err.message).toContain("IVXP:ORDER_NOT_FOUND");
        expect(err.message).toContain("getStatus failed");
        expect(err.cause).toBe(ivxpErr);
        return true;
      });
    });

    it("passes non-IVXPError errors through as-is", async () => {
      const plainErr = new Error("server error");
      mockClient.getOrderStatus.mockRejectedValue(plainErr);
      await expect(adapter.getStatus(PROVIDER_URL, "ord-1")).rejects.toBe(plainErr);
    });
  });

  // -- download ---------------------------------------------------------------

  describe("download", () => {
    it("delegates to IVXPClient.downloadDeliverable and returns deliverable", async () => {
      mockClient.downloadDeliverable.mockResolvedValue(MOCK_DELIVERABLE);
      const result = await adapter.download(PROVIDER_URL, "ord-1");
      expect(result).toEqual(MOCK_DELIVERABLE);
      expect(mockClient.downloadDeliverable).toHaveBeenCalledWith(PROVIDER_URL, "ord-1", undefined);
    });

    it("passes download options through", async () => {
      mockClient.downloadDeliverable.mockResolvedValue(MOCK_DELIVERABLE);
      const opts = { verifyHash: true };
      await adapter.download(PROVIDER_URL, "ord-1", opts);
      expect(mockClient.downloadDeliverable).toHaveBeenCalledWith(PROVIDER_URL, "ord-1", opts);
    });

    it("converts IVXPError to plain Error", async () => {
      const ivxpErr = new IVXPError("delivery failed", "DELIVERY_FAILED");
      mockClient.downloadDeliverable.mockRejectedValue(ivxpErr);
      await expect(adapter.download(PROVIDER_URL, "ord-1")).rejects.toSatisfy((err: Error) => {
        expect(err).not.toBeInstanceOf(IVXPError);
        expect(err.message).toContain("IVXP:DELIVERY_FAILED");
        expect(err.message).toContain("download failed");
        expect(err.cause).toBe(ivxpErr);
        return true;
      });
    });

    it("passes non-IVXPError errors through as-is", async () => {
      const plainErr = new Error("disk full");
      mockClient.downloadDeliverable.mockRejectedValue(plainErr);
      await expect(adapter.download(PROVIDER_URL, "ord-1")).rejects.toBe(plainErr);
    });
  });
});

// -- toLangGraphError standalone tests ----------------------------------------

describe("toLangGraphError", () => {
  it("converts IVXPError to plain Error with formatted message", () => {
    const ivxpErr = new IVXPError("something broke", "SOME_CODE");
    const result = toLangGraphError(ivxpErr, "testOp");
    expect(result).toBeInstanceOf(Error);
    expect(result).not.toBeInstanceOf(IVXPError);
    expect(result.message).toBe("[IVXP:SOME_CODE] testOp failed: something broke");
    expect(result.cause).toBe(ivxpErr);
  });

  it("returns plain Error as-is", () => {
    const plainErr = new Error("plain");
    const result = toLangGraphError(plainErr, "testOp");
    expect(result).toBe(plainErr);
  });

  it("wraps non-Error values in a new Error", () => {
    const result = toLangGraphError("string error", "testOp");
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("[IVXP] testOp failed: string error");
  });

  it("wraps null/undefined in a new Error", () => {
    const result = toLangGraphError(null, "testOp");
    expect(result.message).toBe("[IVXP] testOp failed: null");
  });
});
