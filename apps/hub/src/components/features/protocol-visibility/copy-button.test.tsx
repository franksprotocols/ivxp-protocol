import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CopyButton } from "./copy-button";

// ---------------------------------------------------------------------------
// Mock clipboard
// ---------------------------------------------------------------------------

const mockWriteText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(navigator, {
    clipboard: { writeText: mockWriteText },
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CopyButton", () => {
  it("renders with copy icon by default", () => {
    render(<CopyButton value="test-value" />);
    const btn = screen.getByRole("button", { name: /copy/i });
    expect(btn).toBeInTheDocument();
  });

  it("copies value to clipboard on click", async () => {
    render(<CopyButton value="abc123" label="order ID" />);
    fireEvent.click(screen.getByRole("button", { name: /copy order id/i }));
    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith("abc123");
    });
  });

  it("shows check icon after successful copy", async () => {
    render(<CopyButton value="test" />);
    fireEvent.click(screen.getByRole("button", { name: /copy/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument();
    });
  });

  it("shows error icon when copy fails", async () => {
    mockWriteText.mockRejectedValueOnce(new Error("Permission denied"));
    // Also mock the fallback execCommand path to fail
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "textarea") {
        throw new Error("fallback also fails");
      }
      return origCreateElement(tag);
    });

    render(<CopyButton value="test" />);
    fireEvent.click(screen.getByRole("button", { name: /copy/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /copy failed/i })).toBeInTheDocument();
    });

    vi.restoreAllMocks();
  });

  it("uses custom label in aria-label", () => {
    render(<CopyButton value="val" label="tx hash" />);
    expect(screen.getByRole("button", { name: /copy tx hash/i })).toBeInTheDocument();
  });
});
