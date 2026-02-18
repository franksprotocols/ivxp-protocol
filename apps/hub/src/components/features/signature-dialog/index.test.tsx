import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SignatureDialog } from "./index";
import type { Address } from "viem";

// ---------------------------------------------------------------------------
// Mock wagmi hooks
// ---------------------------------------------------------------------------

const mockSignMessageAsync = vi.fn();

vi.mock("wagmi", () => ({
  useAccount: () => ({
    address: "0xUserAddress0000000000000000000000000001" as Address,
  }),
  useSignMessage: () => ({
    signMessageAsync: mockSignMessageAsync,
  }),
}));

// ---------------------------------------------------------------------------
// Mock IVXP client adapter
// ---------------------------------------------------------------------------

const mockRequestDelivery = vi.fn();
vi.mock("@/hooks/use-ivxp-client", () => ({
  useIVXPClient: () => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    requestQuote: vi.fn(),
    requestDelivery: mockRequestDelivery,
    getOrderStatus: vi.fn(),
    downloadDeliverable: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Mock order store
// ---------------------------------------------------------------------------

const mockUpdateOrderSignature = vi.fn();
const mockGetOrder = vi.fn();
vi.mock("@/stores/order-store", () => ({
  useOrderStore: Object.assign(
    (selector: (s: Record<string, unknown>) => unknown) =>
      selector({
        updateOrderSignature: mockUpdateOrderSignature,
        getOrder: mockGetOrder,
      }),
    {
      getState: () => ({
        updateOrderSignature: mockUpdateOrderSignature,
        getOrder: mockGetOrder,
      }),
    },
  ),
}));

// ---------------------------------------------------------------------------
// Mock next/navigation
// ---------------------------------------------------------------------------

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORDER_ID = "order-sig-dialog-1";
const TX_HASH =
  "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as `0x${string}`;
const FAKE_SIGNATURE = "0xfakesignature123" as `0x${string}`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SignatureDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    orderId: ORDER_ID,
    txHash: TX_HASH,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrder.mockReturnValue(undefined);
    mockSignMessageAsync.mockResolvedValue(FAKE_SIGNATURE);
    mockRequestDelivery.mockResolvedValue({
      order_id: ORDER_ID,
      status: "processing",
    });
  });

  it("renders dialog with correct heading and description", () => {
    render(<SignatureDialog {...defaultProps} />);

    expect(screen.getByText("Verify Your Identity")).toBeInTheDocument();
    expect(screen.getByText(/Sign a message to prove wallet ownership/)).toBeInTheDocument();
    expect(screen.getByText(/Free, no gas required/)).toBeInTheDocument();
  });

  it("shows Sign Message and Cancel buttons", () => {
    render(<SignatureDialog {...defaultProps} />);

    expect(screen.getByRole("button", { name: /sign message/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("displays the message to be signed in monospace block", () => {
    render(<SignatureDialog {...defaultProps} />);

    const messageBlock = screen.getByTestId("signature-message");
    expect(messageBlock).toBeInTheDocument();
    expect(messageBlock.textContent).toContain("IVXP Identity Verification");
    expect(messageBlock.textContent).toContain(ORDER_ID);
  });

  it("calls signAndDeliver when Sign Message is clicked", async () => {
    render(<SignatureDialog {...defaultProps} />);

    const signButton = screen.getByRole("button", { name: /sign message/i });
    fireEvent.click(signButton);

    await waitFor(() => {
      expect(mockSignMessageAsync).toHaveBeenCalledTimes(1);
    });
  });

  it("shows rejection error with Retry Signature button", async () => {
    const rejectionError = new Error("User rejected the request.");
    Object.defineProperty(rejectionError, "name", {
      value: "UserRejectedRequestError",
    });
    mockSignMessageAsync.mockRejectedValueOnce(rejectionError);

    render(<SignatureDialog {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /sign message/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Signature rejected/);
    });

    expect(screen.getByRole("button", { name: /retry signature/i })).toBeInTheDocument();
  });

  it("shows delivery error with Retry button", async () => {
    mockRequestDelivery.mockRejectedValueOnce(new Error("Network error"));

    render(<SignatureDialog {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /sign message/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Network error/);
    });

    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("calls onOpenChange when Cancel is clicked", () => {
    render(<SignatureDialog {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not render when open is false", () => {
    render(<SignatureDialog {...defaultProps} open={false} />);

    expect(screen.queryByText("Verify Your Identity")).not.toBeInTheDocument();
  });

  // Issue #5: aria-live region for screen reader announcements
  it("has aria-live region with idle state announcement", () => {
    render(<SignatureDialog {...defaultProps} />);

    const liveRegion = document.querySelector("[aria-live='polite']");
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveTextContent("Ready to sign message.");
  });

  // Issue #5: aria-busy on Sign Message button
  it("Sign Message button has aria-busy=false when idle", () => {
    render(<SignatureDialog {...defaultProps} />);

    const signButton = screen.getByRole("button", { name: /sign message/i });
    expect(signButton).toHaveAttribute("aria-busy", "false");
  });
});
