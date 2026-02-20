import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaymentDialog } from "./index";
import type { Address } from "viem";
import type { PaymentStep, PaymentError } from "@/hooks/use-payment";

// ---------------------------------------------------------------------------
// Mock usePayment hook
// ---------------------------------------------------------------------------

const mockInitiatePayment = vi.fn();
const mockRetry = vi.fn();
const mockRetryVerification = vi.fn();

let mockPaymentState: {
  step: PaymentStep;
  txHash: `0x${string}` | null;
  blockNumber: bigint | null;
  error: PaymentError | null;
  balance: string | null;
  isRetrying: boolean;
};

vi.mock("@/hooks/use-payment", () => ({
  usePayment: () => ({
    ...mockPaymentState,
    initiatePayment: mockInitiatePayment,
    retry: mockRetry,
    retryVerification: mockRetryVerification,
  }),
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: undefined }),
}));

// ---------------------------------------------------------------------------
// Mock useIdentitySignature (used by SignatureDialog)
// ---------------------------------------------------------------------------

vi.mock("@/hooks/use-identity-signature", () => ({
  useIdentitySignature: () => ({
    step: "idle",
    signature: null,
    error: null,
    errorCode: null,
    message: null,
    signAndDeliver: vi.fn(),
    retryDelivery: vi.fn(),
  }),
  SIGNATURE_ERROR_CODES: {
    WALLET_DISCONNECTED: "WALLET_DISCONNECTED",
    USER_REJECTED: "USER_REJECTED",
    DELIVERY_FAILED: "DELIVERY_FAILED",
    SIGNING_FAILED: "SIGNING_FAILED",
  },
}));

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROVIDER_ADDR = "0xProviderAddress000000000000000000000001" as Address;
const FAKE_TX_HASH =
  "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as `0x${string}`;
const onOpenChange = vi.fn();
const onPaymentComplete = vi.fn();

const defaultProps = {
  open: true,
  onOpenChange,
  orderId: "order-1",
  priceUsdc: "1.50",
  providerAddress: PROVIDER_ADDR,
  onPaymentComplete,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PaymentDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPaymentState = {
      step: "idle",
      txHash: null,
      blockNumber: null,
      error: null,
      balance: null,
      isRetrying: false,
    };
  });

  it("renders dialog with title and price", () => {
    render(<PaymentDialog {...defaultProps} />);
    expect(screen.getByText("Payment")).toBeInTheDocument();
    expect(screen.getByText(/1\.50 USDC/)).toBeInTheDocument();
  });

  it("shows step progress indicator", () => {
    mockPaymentState = { ...mockPaymentState, step: "transferring" };
    render(<PaymentDialog {...defaultProps} />);
    expect(screen.getByText("Transfer USDC")).toBeInTheDocument();
    expect(screen.getByText("Check Balance")).toBeInTheDocument();
  });

  it("shows balance when available", () => {
    mockPaymentState = { ...mockPaymentState, step: "checking-balance", balance: "10.5" };
    render(<PaymentDialog {...defaultProps} />);
    expect(screen.getByText(/Balance: 10\.5 USDC/)).toBeInTheDocument();
  });

  it("shows transaction link after submission", () => {
    mockPaymentState = {
      ...mockPaymentState,
      step: "confirming",
      txHash: FAKE_TX_HASH,
    };
    render(<PaymentDialog {...defaultProps} />);
    const link = screen.getByRole("link", { name: /View transaction/ });
    expect(link).toHaveAttribute("href", expect.stringContaining("basescan.org"));
  });

  it("shows insufficient balance error", () => {
    mockPaymentState = {
      ...mockPaymentState,
      step: "error",
      balance: "0.5",
      error: {
        message: "Insufficient USDC balance. You have 0.5 USDC but need 1.50 USDC.",
        code: "INSUFFICIENT_BALANCE",
        recoverable: false,
      },
    };
    render(<PaymentDialog {...defaultProps} />);
    expect(screen.getByText("Insufficient USDC Balance")).toBeInTheDocument();
    expect(screen.getByText(/You have 0\.5 USDC/)).toBeInTheDocument();
  });

  it("shows retry button on generic error", async () => {
    const user = userEvent.setup();
    mockPaymentState = {
      ...mockPaymentState,
      step: "error",
      error: {
        message: "User rejected the request.",
        code: "PAYMENT_FAILED",
        recoverable: true,
      },
    };
    render(<PaymentDialog {...defaultProps} />);
    expect(screen.getByText("Payment Error")).toBeInTheDocument();

    const retryBtn = screen.getByRole("button", { name: "Retry" });
    await user.click(retryBtn);
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it("shows recovery UI on partial success", async () => {
    const user = userEvent.setup();
    mockPaymentState = {
      ...mockPaymentState,
      step: "partial-success",
      txHash: FAKE_TX_HASH,
      error: {
        message: "Payment sent but verification failed.",
        code: "PARTIAL_SUCCESS",
        recoverable: true,
      },
    };
    render(<PaymentDialog {...defaultProps} />);
    expect(screen.getByText(/payment sent but verification failed/i)).toBeInTheDocument();

    const retryBtn = screen.getByRole("button", { name: "Retry Verification" });
    await user.click(retryBtn);
    expect(mockRetryVerification).toHaveBeenCalledTimes(1);
  });

  it("shows success state when confirmed", () => {
    mockPaymentState = {
      ...mockPaymentState,
      step: "confirmed",
      txHash: FAKE_TX_HASH,
      blockNumber: 42n,
    };
    render(<PaymentDialog {...defaultProps} />);
    expect(screen.getByText("Payment confirmed")).toBeInTheDocument();
  });

  it("calls onPaymentComplete when confirmed", () => {
    mockPaymentState = {
      ...mockPaymentState,
      step: "confirmed",
      txHash: FAKE_TX_HASH,
      blockNumber: 42n,
    };
    render(<PaymentDialog {...defaultProps} />);
    expect(onPaymentComplete).toHaveBeenCalledWith(FAKE_TX_HASH, 42n);
  });

  it("does not show retry for insufficient balance errors", () => {
    mockPaymentState = {
      ...mockPaymentState,
      step: "error",
      error: {
        message: "Insufficient USDC balance.",
        code: "INSUFFICIENT_BALANCE",
        recoverable: false,
      },
    };
    render(<PaymentDialog {...defaultProps} />);
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });
});
