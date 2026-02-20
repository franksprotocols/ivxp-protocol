import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useDeliverable } from "./use-deliverable";
import type { DeliverableResponse } from "./use-ivxp-client";
import { useOrderStore } from "@/stores/order-store";

function textToArrayBuffer(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer as ArrayBuffer;
}

async function computeSha256(content: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", Buffer.from(new Uint8Array(content)));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

let mockDownloadDeliverable: ReturnType<typeof vi.fn>;
const mockEmit = vi.fn();

vi.mock("./use-ivxp-client", () => ({
  useIVXPClient: () => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: mockEmit,
    requestQuote: vi.fn(),
    requestDelivery: vi.fn(),
    getOrderStatus: vi.fn(),
    downloadDeliverable: mockDownloadDeliverable,
  }),
}));

describe("useDeliverable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDownloadDeliverable = vi.fn();
    useOrderStore.getState().clearOrders();
  });

  it("starts in idle state", () => {
    const { result } = renderHook(() => useDeliverable("ord_1"));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.content).toBeNull();
    expect(result.current.hashStatus).toBe("idle");
  });

  it("downloads deliverable and verifies hash on success", async () => {
    const buffer = textToArrayBuffer("Hello, IVXP!");
    const correctHash = await computeSha256(buffer);

    mockDownloadDeliverable.mockResolvedValue({
      content: buffer,
      contentType: "text/plain",
      contentHash: correctHash,
      fileName: "result.txt",
    } satisfies DeliverableResponse);

    const { result } = renderHook(() => useDeliverable("ord_1"));

    await act(async () => {
      await result.current.download();
    });

    await waitFor(() => {
      expect(result.current.hashStatus).toBe("verified");
    });

    expect(result.current.content).toEqual(buffer);
    expect(result.current.fileName).toBe("result.txt");
    expect(mockDownloadDeliverable).toHaveBeenCalledWith("http://localhost:3001", "ord_1");
    expect(mockEmit).toHaveBeenCalledWith(
      "order.delivered",
      expect.objectContaining({ orderId: "ord_1", contentHash: correctHash }),
    );
  });

  it("sets hash status to failed when hash mismatch occurs", async () => {
    const buffer = textToArrayBuffer("some content");

    mockDownloadDeliverable.mockResolvedValue({
      content: buffer,
      contentType: "text/plain",
      contentHash: "0000000000000000000000000000000000000000000000000000000000000000",
    } satisfies DeliverableResponse);

    const { result } = renderHook(() => useDeliverable("ord_1"));

    await act(async () => {
      await result.current.download();
    });

    await waitFor(() => {
      expect(result.current.hashStatus).toBe("failed");
    });
    expect(result.current.error).toBe("Content hash verification failed");
  });

  it("sets error state on download failure", async () => {
    mockDownloadDeliverable.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useDeliverable("ord_1"));

    await act(async () => {
      await result.current.download();
    });

    expect(result.current.error).toBe("Network error");
    expect(result.current.isLoading).toBe(false);
    expect(result.current.retryCount).toBe(1);
  });

  it("uses provider endpoint from order context", async () => {
    useOrderStore.getState().addOrder({
      orderId: "ord_ctx_1",
      serviceType: "text_echo",
      priceUsdc: "1.00",
      providerAddress: "0x1234567890abcdef1234567890abcdef12345678",
      providerEndpointUrl: "http://provider.custom:3001",
      status: "delivered",
      createdAt: Date.now(),
    });
    const buffer = textToArrayBuffer("content");
    const hash = await computeSha256(buffer);
    mockDownloadDeliverable.mockResolvedValue({
      content: buffer,
      contentType: "text/plain",
      contentHash: hash,
    } satisfies DeliverableResponse);

    const { result } = renderHook(() => useDeliverable("ord_ctx_1"));
    await act(async () => {
      await result.current.download();
    });

    expect(mockDownloadDeliverable).toHaveBeenCalledWith(
      "http://provider.custom:3001",
      "ord_ctx_1",
    );
  });
});
