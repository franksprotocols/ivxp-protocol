import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useDeliverable } from "./use-deliverable";
import type { DeliverableResponse } from "./use-ivxp-client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function textToArrayBuffer(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer as ArrayBuffer;
}

async function computeSha256(content: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", content);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Mock IVXPClient
// ---------------------------------------------------------------------------

let mockDownloadDeliverable: ReturnType<typeof vi.fn>;
let mockClient: {
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  downloadDeliverable: ReturnType<typeof vi.fn>;
} | null;

vi.mock("./use-ivxp-client", () => ({
  useIVXPClient: () => mockClient,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useDeliverable", () => {
  beforeEach(() => {
    mockDownloadDeliverable = vi.fn();
    mockClient = {
      on: vi.fn(),
      off: vi.fn(),
      downloadDeliverable: mockDownloadDeliverable,
    };
  });

  it("starts in idle state", () => {
    const { result } = renderHook(() => useDeliverable("ord_1"));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.content).toBeNull();
    expect(result.current.hashStatus).toBe("idle");
  });

  it("downloads deliverable and verifies hash on success", async () => {
    const textContent = "Hello, IVXP!";
    const buffer = textToArrayBuffer(textContent);
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
    expect(result.current.contentType).toBe("text/plain");
    expect(result.current.fileName).toBe("result.txt");
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("sets hash status to failed and does not store content when hash does not match", async () => {
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

    // Content should NOT be stored when hash fails
    expect(result.current.content).toBeNull();
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
    expect(result.current.content).toBeNull();
  });

  it("retry re-triggers download after failure", async () => {
    const buffer = textToArrayBuffer("retry content");
    const correctHash = await computeSha256(buffer);

    mockDownloadDeliverable.mockRejectedValueOnce(new Error("Timeout")).mockResolvedValueOnce({
      content: buffer,
      contentType: "application/json",
      contentHash: correctHash,
    } satisfies DeliverableResponse);

    const { result } = renderHook(() => useDeliverable("ord_1"));

    // First attempt fails -- retryCount increments
    await act(async () => {
      await result.current.download();
    });
    expect(result.current.error).toBe("Timeout");
    expect(result.current.retryCount).toBe(1);

    // Retry succeeds -- retryCount stays at 1 (only increments on failure)
    await act(async () => {
      await result.current.download();
    });

    await waitFor(() => {
      expect(result.current.hashStatus).toBe("verified");
    });

    expect(result.current.error).toBeNull();
    expect(result.current.retryCount).toBe(1);
  });

  it("handles null client gracefully", async () => {
    mockClient = null;

    const { result } = renderHook(() => useDeliverable("ord_1"));

    await act(async () => {
      await result.current.download();
    });

    expect(result.current.error).toBe("IVXP client not available");
    expect(result.current.content).toBeNull();
  });

  it("sets loading state during download", async () => {
    let resolveDownload: (value: DeliverableResponse) => void;
    const downloadPromise = new Promise<DeliverableResponse>((resolve) => {
      resolveDownload = resolve;
    });
    mockDownloadDeliverable.mockReturnValue(downloadPromise);

    const { result } = renderHook(() => useDeliverable("ord_1"));

    act(() => {
      result.current.download();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
    });

    const buffer = textToArrayBuffer("done");
    const hash = await computeSha256(buffer);

    await act(async () => {
      resolveDownload!({
        content: buffer,
        contentType: "text/plain",
        contentHash: hash,
      });
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it("resets state when orderId changes", async () => {
    const buffer = textToArrayBuffer("content");
    const hash = await computeSha256(buffer);

    mockDownloadDeliverable.mockResolvedValue({
      content: buffer,
      contentType: "text/plain",
      contentHash: hash,
    } satisfies DeliverableResponse);

    let orderId = "ord_1";
    const { result, rerender } = renderHook(() => useDeliverable(orderId));

    await act(async () => {
      await result.current.download();
    });

    await waitFor(() => {
      expect(result.current.content).not.toBeNull();
    });

    orderId = "ord_2";
    rerender();

    expect(result.current.content).toBeNull();
    expect(result.current.hashStatus).toBe("idle");
    expect(result.current.retryCount).toBe(0);
  });

  it("resets state when orderId changes during active download", async () => {
    let resolveDownload: (value: DeliverableResponse) => void;
    const downloadPromise = new Promise<DeliverableResponse>((resolve) => {
      resolveDownload = resolve;
    });
    mockDownloadDeliverable.mockReturnValue(downloadPromise);

    let orderId = "ord_1";
    const { result, rerender } = renderHook(() => useDeliverable(orderId));

    // Start download
    act(() => {
      result.current.download();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
    });

    // Change orderId while download is in progress
    orderId = "ord_2";
    rerender();

    // State should be reset
    expect(result.current.content).toBeNull();
    expect(result.current.hashStatus).toBe("idle");
    expect(result.current.isLoading).toBe(false);
    expect(result.current.retryCount).toBe(0);
  });

  it("handles empty ArrayBuffer (0-byte deliverable)", async () => {
    const emptyBuffer = new ArrayBuffer(0);
    const emptyHash = await computeSha256(emptyBuffer);

    mockDownloadDeliverable.mockResolvedValue({
      content: emptyBuffer,
      contentType: "text/plain",
      contentHash: emptyHash,
    } satisfies DeliverableResponse);

    const { result } = renderHook(() => useDeliverable("ord_1"));

    await act(async () => {
      await result.current.download();
    });

    await waitFor(() => {
      expect(result.current.hashStatus).toBe("verified");
    });

    expect(result.current.content).toEqual(emptyBuffer);
    expect(result.current.error).toBeNull();
  });
});
