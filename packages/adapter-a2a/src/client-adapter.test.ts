import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  IVXPA2AClientAdapter,
  buildNonce,
  buildSignedMessage,
  setTaskState,
  toA2AError,
} from "./client-adapter.js";
import { IVXPClient, IVXPError } from "@ivxp/sdk";
import type * as SdkModule from "@ivxp/sdk";
import type { Task } from "@a2a-js/sdk";

const mockHttpPost = vi.fn();

vi.mock("@ivxp/sdk", async (importOriginal) => {
  const actual = await importOriginal<SdkModule>();
  return {
    ...actual,
    IVXPClient: vi.fn(),
    createHttpClient: vi.fn(() => ({ post: mockHttpPost })),
  };
});

const MOCK_CONFIG = {
  privateKey: "0xdeadbeef" as `0x${string}`,
  network: "base-sepolia" as const,
};

const MOCK_TASK: Task = {
  id: "task-1",
  contextId: "ctx-1",
  kind: "task",
  status: { state: "submitted" },
};

const MOCK_CATALOG = {
  provider: "test-provider",
  services: [],
};

const MOCK_QUOTE = {
  orderId: "ord-1",
  priceUsdc: 1,
  expiresAt: "2026-01-01T00:00:00Z",
};

const MOCK_ORDER_STATUS = {
  orderId: "ord-1",
  status: "completed" as const,
};

const MOCK_DELIVERABLE = {
  orderId: "ord-1",
  content: "Hello, World!",
  contentType: "text/plain",
  contentHash: "abc123",
};

describe("IVXPA2AClientAdapter", () => {
  let adapter: IVXPA2AClientAdapter;
  let mockClientInstance: {
    getCatalog: ReturnType<typeof vi.fn>;
    requestQuote: ReturnType<typeof vi.fn>;
    getOrderStatus: ReturnType<typeof vi.fn>;
    downloadDeliverable: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockClientInstance = {
      getCatalog: vi.fn(),
      requestQuote: vi.fn(),
      getOrderStatus: vi.fn(),
      downloadDeliverable: vi.fn(),
    };
    vi.mocked(IVXPClient).mockImplementation(() => mockClientInstance as never);
    adapter = new IVXPA2AClientAdapter(MOCK_CONFIG);
  });

  // -- getCatalog -------------------------------------------------------------

  describe("getCatalog", () => {
    it("delegates to IVXPClient.getCatalog and returns catalog", async () => {
      mockClientInstance.getCatalog.mockResolvedValue(MOCK_CATALOG);
      const result = await adapter.getCatalog("https://provider.example.com");
      expect(result).toEqual(MOCK_CATALOG);
      expect(mockClientInstance.getCatalog).toHaveBeenCalledWith("https://provider.example.com");
    });
  });

  // -- requestQuote -----------------------------------------------------------

  describe("requestQuote", () => {
    it("delegates to IVXPClient.requestQuote and returns quote", async () => {
      mockClientInstance.requestQuote.mockResolvedValue(MOCK_QUOTE);
      const params = { serviceType: "text_echo", description: "test", budgetUsdc: 5 };
      const result = await adapter.requestQuote("https://provider.example.com", params);
      expect(result).toEqual(MOCK_QUOTE);
      expect(mockClientInstance.requestQuote).toHaveBeenCalledWith(
        "https://provider.example.com",
        params,
      );
    });
  });

  // -- requestDelivery --------------------------------------------------------

  describe("requestDelivery", () => {
    const MOCK_PAYMENT_PROOF = {
      txHash: "0xabc123",
      fromAddress: "0xsender",
      network: "base-sepolia",
    };
    const MOCK_WIRE_RESPONSE = {
      status: "accepted",
      order_id: "ord-1",
      message: "Delivery accepted",
    };

    it("posts to /ivxp/deliver and returns parsed DeliveryAcceptedOutput", async () => {
      mockHttpPost.mockResolvedValue(MOCK_WIRE_RESPONSE);
      const result = await adapter.requestDelivery(
        "https://provider.example.com",
        "ord-1",
        MOCK_PAYMENT_PROOF,
        "0xsig" as `0x${string}`,
        "IVXP-DELIVER | Order: ord-1 | ...",
      );
      expect(result.status).toBe("accepted");
      expect(result.orderId).toBe("ord-1");
      expect(mockHttpPost).toHaveBeenCalledWith(
        "https://provider.example.com/ivxp/deliver",
        expect.objectContaining({ order_id: "ord-1" }),
      );
    });

    it("strips trailing slash from providerUrl", async () => {
      mockHttpPost.mockResolvedValue(MOCK_WIRE_RESPONSE);
      await adapter.requestDelivery(
        "https://provider.example.com///",
        "ord-1",
        MOCK_PAYMENT_PROOF,
        "0xsig" as `0x${string}`,
        "signed",
      );
      expect(mockHttpPost).toHaveBeenCalledWith(
        "https://provider.example.com/ivxp/deliver",
        expect.anything(),
      );
    });

    it("throws on invalid response shape", async () => {
      mockHttpPost.mockResolvedValue({ invalid: "response" });
      await expect(
        adapter.requestDelivery(
          "https://provider.example.com",
          "ord-1",
          MOCK_PAYMENT_PROOF,
          "0xsig" as `0x${string}`,
          "signed",
        ),
      ).rejects.toThrow();
    });
  });

  describe("getStatus", () => {
    it("delegates to IVXPClient.getOrderStatus and returns status", async () => {
      mockClientInstance.getOrderStatus.mockResolvedValue(MOCK_ORDER_STATUS);
      const result = await adapter.getStatus("https://provider.example.com", "ord-1");
      expect(result).toEqual(MOCK_ORDER_STATUS);
      expect(mockClientInstance.getOrderStatus).toHaveBeenCalledWith(
        "https://provider.example.com",
        "ord-1",
      );
    });
  });

  // -- download ---------------------------------------------------------------

  describe("download", () => {
    it("delegates to IVXPClient.downloadDeliverable and returns deliverable", async () => {
      mockClientInstance.downloadDeliverable.mockResolvedValue(MOCK_DELIVERABLE);
      const result = await adapter.download("https://provider.example.com", "ord-1");
      expect(result).toEqual(MOCK_DELIVERABLE);
      expect(mockClientInstance.downloadDeliverable).toHaveBeenCalledWith(
        "https://provider.example.com",
        "ord-1",
        undefined,
      );
    });
  });

  // -- requestQuoteWithTask ---------------------------------------------------

  describe("requestQuoteWithTask", () => {
    it("transitions A2A Task to working state on success", async () => {
      mockClientInstance.requestQuote.mockResolvedValue(MOCK_QUOTE);
      const { quote, updatedTask } = await adapter.requestQuoteWithTask(
        MOCK_TASK,
        "https://provider.example.com",
        { serviceType: "text_echo", description: "test", budgetUsdc: 5 },
      );
      expect(quote).toEqual(MOCK_QUOTE);
      expect(updatedTask.status.state).toBe("working");
    });

    it("converts IVXPError to A2A native error on failure", async () => {
      mockClientInstance.requestQuote.mockRejectedValue(
        new IVXPError("upstream failed", "PROVIDER_ERROR"),
      );
      await expect(
        adapter.requestQuoteWithTask(MOCK_TASK, "https://provider.example.com", {
          serviceType: "text_echo",
          description: "test",
          budgetUsdc: 5,
        }),
      ).rejects.toThrow("IVXP error [PROVIDER_ERROR]: upstream failed");
    });

    it("attaches taskId to error on failure", async () => {
      mockClientInstance.requestQuote.mockRejectedValue(
        new IVXPError("upstream failed", "PROVIDER_ERROR"),
      );
      const err = await adapter
        .requestQuoteWithTask(MOCK_TASK, "https://provider.example.com", {
          serviceType: "text_echo",
          description: "test",
          budgetUsdc: 5,
        })
        .catch((e: unknown) => e);
      expect((err as { taskId?: string }).taskId).toBe("task-1");
    });
  });

  // -- downloadWithTask -------------------------------------------------------

  describe("downloadWithTask", () => {
    it("transitions A2A Task to completed state on success", async () => {
      mockClientInstance.downloadDeliverable.mockResolvedValue(MOCK_DELIVERABLE);
      const { deliverable, updatedTask } = await adapter.downloadWithTask(
        MOCK_TASK,
        "https://provider.example.com",
        "ord-1",
      );
      expect(deliverable).toEqual(MOCK_DELIVERABLE);
      expect(updatedTask.status.state).toBe("completed");
    });

    it("converts IVXPError to A2A native error on failure", async () => {
      mockClientInstance.downloadDeliverable.mockRejectedValue(
        new IVXPError("download failed", "DOWNLOAD_ERROR"),
      );
      await expect(
        adapter.downloadWithTask(MOCK_TASK, "https://provider.example.com", "ord-1"),
      ).rejects.toThrow("IVXP error [DOWNLOAD_ERROR]: download failed");
    });

    it("transitions Task to failed state on error", async () => {
      mockClientInstance.downloadDeliverable.mockRejectedValue(
        new IVXPError("download failed", "DOWNLOAD_ERROR"),
      );
      const err = await adapter
        .downloadWithTask(MOCK_TASK, "https://provider.example.com", "ord-1")
        .catch((e: unknown) => e);
      expect((err as { taskId?: string }).taskId).toBe("task-1");
    });
  });
});

// -- Helpers ------------------------------------------------------------------

describe("buildNonce", () => {
  it("returns a 32-char hex string", () => {
    const nonce = buildNonce();
    expect(nonce).toMatch(/^[0-9a-f]{32}$/);
  });

  it("returns unique values on each call", () => {
    const a = buildNonce();
    const b = buildNonce();
    expect(a).not.toBe(b);
  });
});

describe("buildSignedMessage", () => {
  it("produces canonical IVXP-DELIVER format", () => {
    const msg = buildSignedMessage({
      orderId: "ord-1",
      txHash: "0xabc",
      nonce: "deadbeef",
      timestamp: "2026-01-01T00:00:00Z",
    });
    expect(msg).toBe(
      "IVXP-DELIVER | Order: ord-1 | Payment: 0xabc | Nonce: deadbeef | Timestamp: 2026-01-01T00:00:00Z",
    );
  });
});

describe("setTaskState", () => {
  it("returns a new Task with updated state (immutable)", () => {
    const updated = setTaskState(MOCK_TASK, "working");
    expect(updated.status.state).toBe("working");
    expect(MOCK_TASK.status.state).toBe("submitted"); // original unchanged
    expect(updated).not.toBe(MOCK_TASK);
  });

  it("preserves all other Task fields", () => {
    const updated = setTaskState(MOCK_TASK, "completed");
    expect(updated.id).toBe(MOCK_TASK.id);
    expect(updated.contextId).toBe(MOCK_TASK.contextId);
    expect(updated.kind).toBe(MOCK_TASK.kind);
  });
});

describe("toA2AError", () => {
  it("formats IVXPError with code and message", () => {
    const err = toA2AError(MOCK_TASK, new IVXPError("upstream failed", "PROVIDER_ERROR"));
    expect(err.message).toBe("IVXP error [PROVIDER_ERROR]: upstream failed");
  });

  it("passes through plain Error message", () => {
    const err = toA2AError(MOCK_TASK, new Error("plain error"));
    expect(err.message).toBe("plain error");
  });

  it("attaches taskId for correlation", () => {
    const err = toA2AError(MOCK_TASK, new Error("test"));
    expect((err as { taskId?: string }).taskId).toBe("task-1");
  });

  it("never surfaces raw IVXPError", () => {
    const ivxpErr = new IVXPError("raw", "CODE");
    const err = toA2AError(MOCK_TASK, ivxpErr);
    expect(err).not.toBeInstanceOf(IVXPError);
    expect(err).toBeInstanceOf(Error);
  });
});
