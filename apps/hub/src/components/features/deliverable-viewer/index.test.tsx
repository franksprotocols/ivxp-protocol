import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DeliverableViewer } from "./index";
import type { UseDeliverableReturn } from "@/hooks/use-deliverable";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function textToArrayBuffer(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer as ArrayBuffer;
}

// ---------------------------------------------------------------------------
// Mock useDeliverable hook
// ---------------------------------------------------------------------------

const defaultHookReturn: UseDeliverableReturn = {
  content: null,
  contentType: null,
  fileName: null,
  isLoading: false,
  error: null,
  hashStatus: "idle",
  contentHash: null,
  retryCount: 0,
  download: vi.fn(),
};

let mockHookReturn: UseDeliverableReturn;

vi.mock("@/hooks/use-deliverable", () => ({
  useDeliverable: () => mockHookReturn,
  getContentRenderer: (ct: string | null) => {
    if (!ct) return "unknown";
    if (ct.startsWith("text/markdown")) return "markdown";
    if (ct === "application/json") return "json";
    if (ct.startsWith("text/")) return "text";
    if (ct.startsWith("image/")) return "image";
    return "binary";
  },
  getFileExtension: () => "txt",
  triggerDownload: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DeliverableViewer", () => {
  beforeEach(() => {
    mockHookReturn = { ...defaultHookReturn, download: vi.fn() };
    // Mock URL.createObjectURL for image tests
    globalThis.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing when order status is not delivered", () => {
    const { container } = render(<DeliverableViewer orderId="ord_1" orderStatus="processing" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders download section when order status is delivered", () => {
    render(<DeliverableViewer orderId="ord_1" orderStatus="delivered" />);
    expect(screen.getByRole("button", { name: /download deliverable/i })).toBeInTheDocument();
  });

  it("shows download button that triggers download", () => {
    const mockDownload = vi.fn();
    mockHookReturn = { ...defaultHookReturn, download: mockDownload };

    render(<DeliverableViewer orderId="ord_1" orderStatus="delivered" />);

    const downloadBtn = screen.getByRole("button", { name: /download deliverable/i });
    fireEvent.click(downloadBtn);
    expect(mockDownload).toHaveBeenCalledTimes(1);
  });

  it("shows loading spinner during download", () => {
    mockHookReturn = {
      ...defaultHookReturn,
      isLoading: true,
      download: vi.fn(),
    };

    render(<DeliverableViewer orderId="ord_1" orderStatus="delivered" />);

    expect(screen.getByText(/downloading/i)).toBeInTheDocument();
  });

  it("shows error message with retry button on failure", () => {
    const mockDownload = vi.fn();
    mockHookReturn = {
      ...defaultHookReturn,
      error: "Network error",
      retryCount: 1,
      download: mockDownload,
    };

    render(<DeliverableViewer orderId="ord_1" orderStatus="delivered" />);

    expect(screen.getByText(/network error/i)).toBeInTheDocument();
    const retryBtn = screen.getByRole("button", { name: /retry/i });
    fireEvent.click(retryBtn);
    expect(mockDownload).toHaveBeenCalledTimes(1);
  });

  it("displays text content inline when hash is verified", () => {
    const textContent = "Hello, world!";
    mockHookReturn = {
      ...defaultHookReturn,
      content: textToArrayBuffer(textContent),
      contentType: "text/plain",
      hashStatus: "verified",
      contentHash: "abc123",
      download: vi.fn(),
    };

    render(<DeliverableViewer orderId="ord_1" orderStatus="delivered" />);

    expect(screen.getByText(textContent)).toBeInTheDocument();
  });

  it("displays JSON content formatted when hash is verified", () => {
    const jsonContent = JSON.stringify({ key: "value" });
    mockHookReturn = {
      ...defaultHookReturn,
      content: textToArrayBuffer(jsonContent),
      contentType: "application/json",
      hashStatus: "verified",
      contentHash: "abc123",
      download: vi.fn(),
    };

    render(<DeliverableViewer orderId="ord_1" orderStatus="delivered" />);

    expect(screen.getByText(/"key"/)).toBeInTheDocument();
  });

  it("shows verified badge when hash matches", () => {
    mockHookReturn = {
      ...defaultHookReturn,
      content: textToArrayBuffer("content"),
      contentType: "text/plain",
      hashStatus: "verified",
      contentHash: "abc123def456",
      download: vi.fn(),
    };

    render(<DeliverableViewer orderId="ord_1" orderStatus="delivered" />);

    expect(screen.getByText(/verified/i)).toBeInTheDocument();
  });

  it("shows warning when hash verification fails", () => {
    mockHookReturn = {
      ...defaultHookReturn,
      content: null,
      contentType: null,
      hashStatus: "failed",
      contentHash: "bad_hash",
      error: "Content hash verification failed",
      download: vi.fn(),
    };

    render(<DeliverableViewer orderId="ord_1" orderStatus="delivered" />);

    expect(screen.getByText(/content hash verification failed/i)).toBeInTheDocument();
    // Content should NOT be displayed
    expect(screen.queryByText("tampered content")).not.toBeInTheDocument();
  });

  it("shows hash mismatch badge when hash fails", () => {
    mockHookReturn = {
      ...defaultHookReturn,
      content: null,
      contentType: null,
      hashStatus: "failed",
      contentHash: "bad_hash",
      error: "Content hash verification failed",
      download: vi.fn(),
    };

    render(<DeliverableViewer orderId="ord_1" orderStatus="delivered" />);

    expect(screen.getByText(/hash mismatch/i)).toBeInTheDocument();
  });

  it("shows image preview for image content type", async () => {
    // Create a minimal 1x1 PNG as ArrayBuffer
    const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    mockHookReturn = {
      ...defaultHookReturn,
      content: pngBytes.buffer as ArrayBuffer,
      contentType: "image/png",
      hashStatus: "verified",
      contentHash: "img_hash",
      download: vi.fn(),
    };

    render(<DeliverableViewer orderId="ord_1" orderStatus="delivered" />);

    await waitFor(() => {
      const img = screen.getByRole("img");
      expect(img).toBeInTheDocument();
    });
  });

  it("shows download-only button for binary content", () => {
    mockHookReturn = {
      ...defaultHookReturn,
      content: new ArrayBuffer(8),
      contentType: "application/pdf",
      hashStatus: "verified",
      contentHash: "pdf_hash",
      download: vi.fn(),
    };

    render(<DeliverableViewer orderId="ord_1" orderStatus="delivered" />);

    expect(screen.getByRole("button", { name: /save file/i })).toBeInTheDocument();
  });

  it("displays content hash with truncation", () => {
    mockHookReturn = {
      ...defaultHookReturn,
      content: textToArrayBuffer("content"),
      contentType: "text/plain",
      hashStatus: "verified",
      contentHash: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      download: vi.fn(),
    };

    render(<DeliverableViewer orderId="ord_1" orderStatus="delivered" />);

    // Hash should be displayed (at least partially)
    expect(screen.getByText(/abcdef12/)).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Accessibility tests (#4)
  // ---------------------------------------------------------------------------

  it("error section has role='alert' for screen readers", () => {
    mockHookReturn = {
      ...defaultHookReturn,
      error: "Download failed",
      retryCount: 1,
      download: vi.fn(),
    };

    render(<DeliverableViewer orderId="ord_1" orderStatus="delivered" />);

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/download failed/i);
  });

  it("download button has accessible aria-label", () => {
    render(<DeliverableViewer orderId="ord_1" orderStatus="delivered" />);

    const btn = screen.getByRole("button", { name: /download deliverable/i });
    expect(btn).toBeInTheDocument();
  });

  it("retry button has accessible aria-label", () => {
    mockHookReturn = {
      ...defaultHookReturn,
      error: "Timeout",
      retryCount: 1,
      download: vi.fn(),
    };

    render(<DeliverableViewer orderId="ord_1" orderStatus="delivered" />);

    const retryBtn = screen.getByRole("button", { name: /retry download/i });
    expect(retryBtn).toBeInTheDocument();
  });

  it("loading state is accessible via aria-live region", () => {
    mockHookReturn = {
      ...defaultHookReturn,
      isLoading: true,
      download: vi.fn(),
    };

    render(<DeliverableViewer orderId="ord_1" orderStatus="delivered" />);

    const loadingRegion = screen.getByRole("status");
    expect(loadingRegion).toBeInTheDocument();
    expect(loadingRegion).toHaveTextContent(/downloading/i);
  });

  it("image has descriptive alt text", async () => {
    const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    mockHookReturn = {
      ...defaultHookReturn,
      content: pngBytes.buffer as ArrayBuffer,
      contentType: "image/png",
      hashStatus: "verified",
      contentHash: "img_hash",
      download: vi.fn(),
    };

    render(<DeliverableViewer orderId="ord_1" orderStatus="delivered" />);

    await waitFor(() => {
      const img = screen.getByRole("img");
      expect(img).toHaveAttribute("alt", "Deliverable preview");
    });
  });

  it("save file button is keyboard accessible", () => {
    mockHookReturn = {
      ...defaultHookReturn,
      content: new ArrayBuffer(8),
      contentType: "application/pdf",
      hashStatus: "verified",
      contentHash: "pdf_hash",
      download: vi.fn(),
    };

    render(<DeliverableViewer orderId="ord_1" orderStatus="delivered" />);

    const saveBtn = screen.getByRole("button", { name: /save file/i });
    expect(saveBtn).toBeInTheDocument();
    // Buttons are keyboard-focusable by default
    expect(saveBtn.tagName).toBe("BUTTON");
  });
});
