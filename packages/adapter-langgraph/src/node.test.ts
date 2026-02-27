import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { IVXPLangGraphState } from "./types.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSubmitPayment = vi.fn();
const mockSubscribeToStream = vi.fn();
const mockClient = {
  submitPayment: mockSubmitPayment,
  subscribeToStream: mockSubscribeToStream,
};

vi.mock("@ivxp/sdk", () => ({
  createIVXPClient: vi.fn(() => mockClient),
  IVXPClient: vi.fn(),
  IVXPError: class IVXPError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.name = "IVXPError";
      this.code = code;
    }
  },
}));

const mockGetCatalog = vi.fn();
const mockRequestQuote = vi.fn();
const mockGetStatus = vi.fn();
const mockDownload = vi.fn();

vi.mock("./client-adapter.js", () => ({
  IVXPLangGraphClientAdapter: vi.fn(() => ({
    getCatalog: mockGetCatalog,
    requestQuote: mockRequestQuote,
    getStatus: mockGetStatus,
    download: mockDownload,
  })),
}));

// Import after mocks are set up
const { ivxpNode, createIvxpNode } = await import("./node.js");

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PROVIDER_URL = "https://provider.example.com";
const VALID_PRIVATE_KEY = "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const BASE_STATE: IVXPLangGraphState = {
  providerUrl: PROVIDER_URL,
  serviceType: "text_echo",
  input: { description: "Say hello" },
  budgetUsdc: 10,
};

const MOCK_CATALOG = {
  protocol: "IVXP/1.0",
  provider: "test-provider",
  walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
  services: [
    { type: "text_echo", basePriceUsdc: 1, estimatedDeliveryHours: 1 },
    { type: "code_review", basePriceUsdc: 5, estimatedDeliveryHours: 24 },
  ],
};

const MOCK_QUOTE = {
  protocol: "IVXP/1.0",
  messageType: "service_quote",
  timestamp: "2026-01-01T00:00:00Z",
  orderId: "ord-123",
  providerAgent: {
    name: "test-provider",
    walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
  },
  quote: {
    priceUsdc: 2,
    estimatedDelivery: "2026-01-02T00:00:00Z",
    paymentAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    network: "base-sepolia",
  },
};

const MOCK_PAYMENT_RESULT = {
  orderId: "ord-123",
  txHash: "0xdeadbeef" as `0x${string}`,
  status: "paid" as const,
  streamUrl: undefined as string | undefined,
};

const MOCK_DELIVERABLE = {
  protocol: "IVXP/1.0",
  messageType: "service_delivery",
  timestamp: "2026-01-01T12:00:00Z",
  orderId: "ord-123",
  status: "completed",
  providerAgent: {
    name: "test-provider",
    walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
  },
  deliverable: {
    type: "text",
    format: "plain",
    content: "Hello from IVXP!",
  },
  contentHash: "sha256-abc123",
};

// ---------------------------------------------------------------------------
// createIvxpNode (factory) tests
// ---------------------------------------------------------------------------

describe("createIvxpNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -- Happy path: polling ----------------------------------------------------

  it("completes full flow with polling when no streamUrl", async () => {
    mockGetCatalog.mockResolvedValue(MOCK_CATALOG);
    mockRequestQuote.mockResolvedValue(MOCK_QUOTE);
    mockSubmitPayment.mockResolvedValue({ ...MOCK_PAYMENT_RESULT, streamUrl: undefined });
    mockGetStatus.mockResolvedValue({ orderId: "ord-123", status: "delivered" });
    mockDownload.mockResolvedValue(MOCK_DELIVERABLE);

    const node = createIvxpNode(mockClient as any);
    const result = await node(BASE_STATE);

    expect(result.ivxpResult).toEqual({
      result: "Hello from IVXP!",
      orderId: "ord-123",
      contentHash: "sha256-abc123",
    });
    expect(mockGetCatalog).toHaveBeenCalledWith(PROVIDER_URL);
    expect(mockRequestQuote).toHaveBeenCalledWith(PROVIDER_URL, {
      serviceType: "text_echo",
      description: "Say hello",
      budgetUsdc: 10,
    });
    expect(mockSubmitPayment).toHaveBeenCalledWith(PROVIDER_URL, "ord-123", {
      priceUsdc: 2,
      paymentAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    });
    expect(mockGetStatus).toHaveBeenCalledWith(PROVIDER_URL, "ord-123");
    expect(mockDownload).toHaveBeenCalledWith(PROVIDER_URL, "ord-123");
    expect(mockSubscribeToStream).not.toHaveBeenCalled();
  });

  // -- Happy path: SSE --------------------------------------------------------

  it("uses SSE when streamUrl is present in payment result", async () => {
    mockGetCatalog.mockResolvedValue(MOCK_CATALOG);
    mockRequestQuote.mockResolvedValue(MOCK_QUOTE);
    mockSubmitPayment.mockResolvedValue({
      ...MOCK_PAYMENT_RESULT,
      streamUrl: "https://provider.example.com/stream/ord-123",
    });
    mockSubscribeToStream.mockImplementation(
      (_url: string, handlers: Record<string, (...args: unknown[]) => unknown>) => {
        queueMicrotask(() => handlers.onCompleted?.());
        return Promise.resolve(() => {});
      },
    );
    mockDownload.mockResolvedValue(MOCK_DELIVERABLE);

    const node = createIvxpNode(mockClient as any);
    const result = await node(BASE_STATE);

    expect(result.ivxpResult).toEqual({
      result: "Hello from IVXP!",
      orderId: "ord-123",
      contentHash: "sha256-abc123",
    });
    expect(mockSubscribeToStream).toHaveBeenCalledWith(
      "https://provider.example.com/stream/ord-123",
      expect.objectContaining({
        onCompleted: expect.any(Function),
        onFailed: expect.any(Function),
        onExhausted: expect.any(Function),
      }),
    );
    expect(mockGetStatus).not.toHaveBeenCalled();
  });

  // -- Polling fallback: multiple attempts ------------------------------------

  it("polls multiple times until status is delivered", async () => {
    mockGetCatalog.mockResolvedValue(MOCK_CATALOG);
    mockRequestQuote.mockResolvedValue(MOCK_QUOTE);
    mockSubmitPayment.mockResolvedValue({ ...MOCK_PAYMENT_RESULT, streamUrl: undefined });
    mockGetStatus
      .mockResolvedValueOnce({ orderId: "ord-123", status: "processing" })
      .mockResolvedValueOnce({ orderId: "ord-123", status: "processing" })
      .mockResolvedValueOnce({ orderId: "ord-123", status: "delivered" });
    mockDownload.mockResolvedValue(MOCK_DELIVERABLE);

    const node = createIvxpNode(mockClient as any);
    const promise = node(BASE_STATE);
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await promise;

    expect(result.ivxpResult).toBeDefined();
    expect(mockGetStatus).toHaveBeenCalledTimes(3);
  });

  // -- Budget guard -----------------------------------------------------------

  it("throws before payment when quote price exceeds budget", async () => {
    mockGetCatalog.mockResolvedValue(MOCK_CATALOG);
    // Quote price (15) > budget (10)
    mockRequestQuote.mockResolvedValue({
      ...MOCK_QUOTE,
      quote: { ...MOCK_QUOTE.quote, priceUsdc: 15 },
    });

    const node = createIvxpNode(mockClient as any);
    await expect(node(BASE_STATE)).rejects.toSatisfy((err: Error) => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toContain("15");
      expect(err.message).toContain("exceeds budget");
      return true;
    });
    expect(mockSubmitPayment).not.toHaveBeenCalled();
  });

  // -- Service not found ------------------------------------------------------

  it("throws descriptive error when service not found in catalog", async () => {
    mockGetCatalog.mockResolvedValue({
      ...MOCK_CATALOG,
      services: [{ type: "other_service", basePriceUsdc: 1, estimatedDeliveryHours: 1 }],
    });

    const node = createIvxpNode(mockClient as any);
    await expect(node({ ...BASE_STATE, serviceType: "nonexistent_service" })).rejects.toSatisfy(
      (err: Error) => {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toContain("nonexistent_service");
        expect(err.message).toContain("not found in catalog");
        return true;
      },
    );
  });

  // -- Error propagation ------------------------------------------------------

  it("converts errors to plain Error via toLangGraphError", async () => {
    mockGetCatalog.mockResolvedValue(MOCK_CATALOG);
    mockRequestQuote.mockRejectedValue(new Error("quote failed"));

    const node = createIvxpNode(mockClient as any);
    await expect(node(BASE_STATE)).rejects.toSatisfy((err: Error) => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toContain("quote failed");
      return true;
    });
  });

  // -- Delivery failed via polling --------------------------------------------

  it("throws when polling returns delivery_failed status", async () => {
    mockGetCatalog.mockResolvedValue(MOCK_CATALOG);
    mockRequestQuote.mockResolvedValue(MOCK_QUOTE);
    mockSubmitPayment.mockResolvedValue({ ...MOCK_PAYMENT_RESULT, streamUrl: undefined });
    mockGetStatus.mockResolvedValue({ orderId: "ord-123", status: "delivery_failed" });

    const node = createIvxpNode(mockClient as any);
    await expect(node(BASE_STATE)).rejects.toSatisfy((err: Error) => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toContain("Delivery failed");
      return true;
    });
  });

  // -- SSE failure via onFailed -----------------------------------------------

  it("throws when SSE reports failure via onFailed", async () => {
    mockGetCatalog.mockResolvedValue(MOCK_CATALOG);
    mockRequestQuote.mockResolvedValue(MOCK_QUOTE);
    mockSubmitPayment.mockResolvedValue({
      ...MOCK_PAYMENT_RESULT,
      streamUrl: "https://provider.example.com/stream/ord-123",
    });
    mockSubscribeToStream.mockImplementation(
      (_url: string, handlers: Record<string, (...args: unknown[]) => unknown>) => {
        queueMicrotask(() => handlers.onFailed?.({ reason: "provider error" }));
        return Promise.resolve(() => {});
      },
    );

    const node = createIvxpNode(mockClient as any);
    await expect(node(BASE_STATE)).rejects.toSatisfy((err: Error) => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toContain("Delivery failed via SSE");
      return true;
    });
  });

  // -- SSEExhaustedError wrapping ---------------------------------------------

  it("wraps SSEExhaustedError as plain Error with descriptive message", async () => {
    mockGetCatalog.mockResolvedValue(MOCK_CATALOG);
    mockRequestQuote.mockResolvedValue(MOCK_QUOTE);
    mockSubmitPayment.mockResolvedValue({
      ...MOCK_PAYMENT_RESULT,
      streamUrl: "https://provider.example.com/stream/ord-123",
    });
    const exhaustedErr = Object.assign(new Error("max retries exceeded"), {
      name: "SSEExhaustedError",
    });
    mockSubscribeToStream.mockImplementation(
      (_url: string, handlers: Record<string, (...args: unknown[]) => unknown>) => {
        queueMicrotask(() => handlers.onExhausted?.(exhaustedErr));
        return Promise.resolve(() => {});
      },
    );

    const node = createIvxpNode(mockClient as any);
    await expect(node(BASE_STATE)).rejects.toSatisfy((err: Error) => {
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe("Error");
      expect(err.message).toContain("SSE stream exhausted");
      expect(err.message).toContain("max retries exceeded");
      return true;
    });
  });

  // -- Configurable poll options ----------------------------------------------

  it("respects custom maxAttempts from state.pollOptions", async () => {
    mockGetCatalog.mockResolvedValue(MOCK_CATALOG);
    mockRequestQuote.mockResolvedValue(MOCK_QUOTE);
    mockSubmitPayment.mockResolvedValue({ ...MOCK_PAYMENT_RESULT, streamUrl: undefined });
    // Never returns delivered -- should time out after maxAttempts
    mockGetStatus.mockResolvedValue({ orderId: "ord-123", status: "processing" });

    const stateWithPollOptions: IVXPLangGraphState = {
      ...BASE_STATE,
      pollOptions: { maxAttempts: 3, intervalMs: 100 },
    };

    const node = createIvxpNode(mockClient as any);
    const promise = node(stateWithPollOptions);
    // Attach rejection handler before advancing timers to avoid unhandled rejection
    const rejection = expect(promise).rejects.toSatisfy((err: Error) => {
      expect(err.message).toContain("timed out after 3 attempts");
      return true;
    });
    await vi.advanceTimersByTimeAsync(5_000);
    await rejection;
    expect(mockGetStatus).toHaveBeenCalledTimes(3);
  });

  it("respects custom intervalMs from state.pollOptions", async () => {
    mockGetCatalog.mockResolvedValue(MOCK_CATALOG);
    mockRequestQuote.mockResolvedValue(MOCK_QUOTE);
    mockSubmitPayment.mockResolvedValue({ ...MOCK_PAYMENT_RESULT, streamUrl: undefined });
    mockGetStatus
      .mockResolvedValueOnce({ orderId: "ord-123", status: "processing" })
      .mockResolvedValueOnce({ orderId: "ord-123", status: "delivered" });
    mockDownload.mockResolvedValue(MOCK_DELIVERABLE);

    const stateWithInterval: IVXPLangGraphState = {
      ...BASE_STATE,
      pollOptions: { intervalMs: 500 },
    };

    const node = createIvxpNode(mockClient as any);
    const promise = node(stateWithInterval);
    // Only advance 600ms -- enough for one 500ms interval
    await vi.advanceTimersByTimeAsync(600);
    const result = await promise;

    expect(result.ivxpResult).toBeDefined();
    expect(mockGetStatus).toHaveBeenCalledTimes(2);
  });

  // -- Input serialization ----------------------------------------------------

  it("serializes input as JSON when no description field present", async () => {
    mockGetCatalog.mockResolvedValue(MOCK_CATALOG);
    mockRequestQuote.mockResolvedValue(MOCK_QUOTE);
    mockSubmitPayment.mockResolvedValue({ ...MOCK_PAYMENT_RESULT, streamUrl: undefined });
    mockGetStatus.mockResolvedValue({ orderId: "ord-123", status: "delivered" });
    mockDownload.mockResolvedValue(MOCK_DELIVERABLE);

    const node = createIvxpNode(mockClient as any);
    await node({
      ...BASE_STATE,
      input: { prompt: "Generate code", language: "typescript" },
    });

    expect(mockRequestQuote).toHaveBeenCalledWith(PROVIDER_URL, {
      serviceType: "text_echo",
      description: JSON.stringify({ prompt: "Generate code", language: "typescript" }),
      budgetUsdc: 10,
    });
  });

  // -- contentHash fallback ---------------------------------------------------

  it("uses empty string for contentHash when not present in deliverable", async () => {
    mockGetCatalog.mockResolvedValue(MOCK_CATALOG);
    mockRequestQuote.mockResolvedValue(MOCK_QUOTE);
    mockSubmitPayment.mockResolvedValue({ ...MOCK_PAYMENT_RESULT, streamUrl: undefined });
    mockGetStatus.mockResolvedValue({ orderId: "ord-123", status: "delivered" });
    mockDownload.mockResolvedValue({ ...MOCK_DELIVERABLE, contentHash: undefined });

    const node = createIvxpNode(mockClient as any);
    const result = await node(BASE_STATE);

    expect(result.ivxpResult?.contentHash).toBe("");
  });
});

// ---------------------------------------------------------------------------
// ivxpNode (convenience wrapper) tests
// ---------------------------------------------------------------------------

describe("ivxpNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    process.env.IVXP_PRIVATE_KEY = VALID_PRIVATE_KEY;
    process.env.IVXP_NETWORK = "base-sepolia";
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.IVXP_PRIVATE_KEY;
    delete process.env.IVXP_NETWORK;
  });

  it("completes full flow reading credentials from env vars", async () => {
    mockGetCatalog.mockResolvedValue(MOCK_CATALOG);
    mockRequestQuote.mockResolvedValue(MOCK_QUOTE);
    mockSubmitPayment.mockResolvedValue({ ...MOCK_PAYMENT_RESULT, streamUrl: undefined });
    mockGetStatus.mockResolvedValue({ orderId: "ord-123", status: "delivered" });
    mockDownload.mockResolvedValue(MOCK_DELIVERABLE);

    const result = await ivxpNode(BASE_STATE);

    expect(result.ivxpResult).toEqual({
      result: "Hello from IVXP!",
      orderId: "ord-123",
      contentHash: "sha256-abc123",
    });
  });

  // -- Env validation: missing key --------------------------------------------

  it("throws when IVXP_PRIVATE_KEY is missing", async () => {
    delete process.env.IVXP_PRIVATE_KEY;

    await expect(ivxpNode(BASE_STATE)).rejects.toSatisfy((err: Error) => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toContain("IVXP_PRIVATE_KEY");
      expect(err.message).toContain("required");
      return true;
    });
    expect(mockGetCatalog).not.toHaveBeenCalled();
  });

  // -- Env validation: malformed key ------------------------------------------

  it("throws when IVXP_PRIVATE_KEY is malformed", async () => {
    process.env.IVXP_PRIVATE_KEY = "not-a-valid-key";

    await expect(ivxpNode(BASE_STATE)).rejects.toSatisfy((err: Error) => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toContain("IVXP_PRIVATE_KEY");
      expect(err.message).toContain("0x-prefixed");
      return true;
    });
    expect(mockGetCatalog).not.toHaveBeenCalled();
  });

  it("throws when IVXP_PRIVATE_KEY is too short", async () => {
    process.env.IVXP_PRIVATE_KEY = "0xdeadbeef";

    await expect(ivxpNode(BASE_STATE)).rejects.toSatisfy((err: Error) => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toContain("IVXP_PRIVATE_KEY");
      return true;
    });
  });
});
