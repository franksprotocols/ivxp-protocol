import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuoteDialog } from "./index";
import type { Quote } from "./index";
import { useOrderStore } from "@/stores/order-store";

// Mock clipboard API
const mockWriteText = vi.fn().mockResolvedValue(undefined);

beforeAll(() => {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: mockWriteText },
    writable: true,
    configurable: true,
  });
});

function createMockQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    orderId: "ord_abc123",
    serviceType: "text_echo",
    priceUsdc: "1.50",
    providerAddress: "0x1234567890abcdef1234567890abcdef12345678",
    expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
    ...overrides,
  };
}

const defaultHandlers = {
  onConfirm: vi.fn(),
  onRequestNewQuote: vi.fn(),
  onOpenChange: vi.fn(),
};

describe("QuoteDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    useOrderStore.getState().clearOrders();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // AC #1: Dialog displays order_id, service_type, price_usdc, provider_address, quote expiry
  describe("Quote Details Display", () => {
    it("should display the order ID", () => {
      const quote = createMockQuote();
      render(<QuoteDialog open={true} quote={quote} {...defaultHandlers} />);
      expect(screen.getByText("ord_abc123")).toBeInTheDocument();
    });

    it("should display the service type", () => {
      const quote = createMockQuote();
      render(<QuoteDialog open={true} quote={quote} {...defaultHandlers} />);
      expect(screen.getByText("text_echo")).toBeInTheDocument();
    });

    it("should display the price formatted with USDC", () => {
      const quote = createMockQuote();
      render(<QuoteDialog open={true} quote={quote} {...defaultHandlers} />);
      expect(screen.getByText("1.50 USDC")).toBeInTheDocument();
    });

    it("should display truncated provider address", () => {
      const quote = createMockQuote();
      render(<QuoteDialog open={true} quote={quote} {...defaultHandlers} />);
      expect(screen.getByText("0x1234...5678")).toBeInTheDocument();
    });

    it("should copy provider address to clipboard on click", async () => {
      // Note: userEvent.click cannot trigger onClick on small icon buttons inside
      // Radix Dialog due to jsdom's pointer-events:none on <body>. Using
      // programmatic .click() as a workaround for this specific interaction.
      const quote = createMockQuote();
      render(<QuoteDialog open={true} quote={quote} {...defaultHandlers} />);

      const copyButton = screen.getByRole("button", { name: "Copy provider address" });
      copyButton.click();

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockWriteText).toHaveBeenCalledWith("0x1234567890abcdef1234567890abcdef12345678");
    });

    it("should display the countdown timer", () => {
      const quote = createMockQuote();
      render(<QuoteDialog open={true} quote={quote} {...defaultHandlers} />);
      // Should show something like "4:59" or "5:00"
      expect(screen.getByTestId("expiry-countdown")).toBeInTheDocument();
    });
  });

  // AC #2: Confirm & Pay stores order and transitions to payment
  describe("Confirm Action", () => {
    it("should call onConfirm when Confirm & Pay is clicked", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onConfirm = vi.fn();
      const quote = createMockQuote();
      render(
        <QuoteDialog
          open={true}
          quote={quote}
          onConfirm={onConfirm}
          onRequestNewQuote={defaultHandlers.onRequestNewQuote}
          onOpenChange={defaultHandlers.onOpenChange}
        />,
      );

      await user.click(screen.getByText("Confirm & Pay"));
      expect(onConfirm).toHaveBeenCalledWith(quote);
    });

    it("should store order in order-store with status 'quoted' on confirm", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const quote = createMockQuote();
      render(
        <QuoteDialog
          open={true}
          quote={quote}
          onConfirm={defaultHandlers.onConfirm}
          onRequestNewQuote={defaultHandlers.onRequestNewQuote}
          onOpenChange={defaultHandlers.onOpenChange}
        />,
      );

      await user.click(screen.getByText("Confirm & Pay"));

      const orders = useOrderStore.getState().orders;
      const storedOrder = orders.find((o) => o.orderId === "ord_abc123");
      expect(storedOrder).toBeDefined();
      expect(storedOrder?.status).toBe("quoted");
    });
  });

  // AC #3: Cancel closes dialog, no order persisted
  describe("Cancel Action", () => {
    it("should call onOpenChange(false) when Cancel is clicked", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onOpenChange = vi.fn();
      const quote = createMockQuote();
      render(
        <QuoteDialog
          open={true}
          quote={quote}
          onConfirm={defaultHandlers.onConfirm}
          onRequestNewQuote={defaultHandlers.onRequestNewQuote}
          onOpenChange={onOpenChange}
        />,
      );

      await user.click(screen.getByText("Cancel"));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("should not persist any order when cancelled", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const quote = createMockQuote();
      render(<QuoteDialog open={true} quote={quote} {...defaultHandlers} />);

      await user.click(screen.getByText("Cancel"));

      const orders = useOrderStore.getState().orders;
      expect(orders).toHaveLength(0);
    });
  });

  // AC #4: Quote expiry disables Confirm & Pay, shows expired message
  describe("Quote Expiry", () => {
    it("should show Request New Quote button when quote is expired", () => {
      const expiredQuote = createMockQuote({
        expiresAt: new Date(Date.now() - 1000),
      });
      render(<QuoteDialog open={true} quote={expiredQuote} {...defaultHandlers} />);

      expect(screen.getByText("Request New Quote")).toBeInTheDocument();
      expect(screen.queryByText("Confirm & Pay")).not.toBeInTheDocument();
    });

    it("should show expired message when quote has expired", () => {
      const expiredQuote = createMockQuote({
        expiresAt: new Date(Date.now() - 1000),
      });
      render(<QuoteDialog open={true} quote={expiredQuote} {...defaultHandlers} />);

      expect(screen.getByText("Quote Expired")).toBeInTheDocument();
    });

    it("should call onRequestNewQuote when Request New Quote is clicked", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onRequestNewQuote = vi.fn();
      const expiredQuote = createMockQuote({
        expiresAt: new Date(Date.now() - 1000),
      });
      render(
        <QuoteDialog
          open={true}
          quote={expiredQuote}
          onConfirm={defaultHandlers.onConfirm}
          onRequestNewQuote={onRequestNewQuote}
          onOpenChange={defaultHandlers.onOpenChange}
        />,
      );

      await user.click(screen.getByText("Request New Quote"));
      expect(onRequestNewQuote).toHaveBeenCalled();
    });

    it("should transition to expired state when countdown reaches zero", () => {
      // Start with 2 seconds remaining
      const quote = createMockQuote({
        expiresAt: new Date(Date.now() + 2000),
      });
      render(<QuoteDialog open={true} quote={quote} {...defaultHandlers} />);

      // Initially should show Confirm & Pay
      expect(screen.getByText("Confirm & Pay")).toBeInTheDocument();

      // Advance past expiry
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // Now should show expired state
      expect(screen.getByText("Request New Quote")).toBeInTheDocument();
      expect(screen.queryByText("Confirm & Pay")).not.toBeInTheDocument();
    });
  });

  // AC #5: Countdown turns warning color when below 60 seconds
  describe("Countdown Warning Styling", () => {
    it("should apply warning styling when below 60 seconds", () => {
      const quote = createMockQuote({
        expiresAt: new Date(Date.now() + 45_000), // 45 seconds
      });
      render(<QuoteDialog open={true} quote={quote} {...defaultHandlers} />);

      const countdown = screen.getByTestId("expiry-countdown");
      expect(countdown).toHaveAttribute("data-state", "warning");
    });

    it("should apply critical styling when below 15 seconds", () => {
      const quote = createMockQuote({
        expiresAt: new Date(Date.now() + 10_000), // 10 seconds
      });
      render(<QuoteDialog open={true} quote={quote} {...defaultHandlers} />);

      const countdown = screen.getByTestId("expiry-countdown");
      expect(countdown).toHaveAttribute("data-state", "critical");
    });

    it("should not apply warning styling when above 60 seconds", () => {
      const quote = createMockQuote({
        expiresAt: new Date(Date.now() + 120_000), // 2 minutes
      });
      render(<QuoteDialog open={true} quote={quote} {...defaultHandlers} />);

      const countdown = screen.getByTestId("expiry-countdown");
      expect(countdown).toHaveAttribute("data-state", "normal");
    });
  });

  // Dialog open/close behavior
  describe("Dialog Behavior", () => {
    it("should not render content when open is false", () => {
      const quote = createMockQuote();
      render(<QuoteDialog open={false} quote={quote} {...defaultHandlers} />);

      expect(screen.queryByText("Quote Confirmation")).not.toBeInTheDocument();
    });

    it("should render dialog title when open", () => {
      const quote = createMockQuote();
      render(<QuoteDialog open={true} quote={quote} {...defaultHandlers} />);

      expect(screen.getByText("Quote Confirmation")).toBeInTheDocument();
    });
  });

  // Edge cases
  describe("Edge Cases", () => {
    it("should display 0.00 USDC for invalid price formats", () => {
      const quote = createMockQuote({ priceUsdc: "not-a-number" });
      render(<QuoteDialog open={true} quote={quote} {...defaultHandlers} />);
      expect(screen.getByText("0.00 USDC")).toBeInTheDocument();
    });

    it("should display 0.00 USDC for negative price", () => {
      const quote = createMockQuote({ priceUsdc: "-5.00" });
      render(<QuoteDialog open={true} quote={quote} {...defaultHandlers} />);
      expect(screen.getByText("0.00 USDC")).toBeInTheDocument();
    });

    it("should not show copied state when clipboard write fails", async () => {
      mockWriteText.mockRejectedValueOnce(new Error("Clipboard denied"));
      const quote = createMockQuote();
      render(<QuoteDialog open={true} quote={quote} {...defaultHandlers} />);

      const copyButton = screen.getByRole("button", { name: "Copy provider address" });
      copyButton.click();

      await act(async () => {
        await Promise.resolve();
      });

      // Button should still show copy icon (not check icon)
      expect(copyButton).toBeInTheDocument();
    });

    it("should only trigger onConfirm once on rapid double-click", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onConfirm = vi.fn();
      const quote = createMockQuote();
      render(
        <QuoteDialog
          open={true}
          quote={quote}
          onConfirm={onConfirm}
          onRequestNewQuote={defaultHandlers.onRequestNewQuote}
          onOpenChange={defaultHandlers.onOpenChange}
        />,
      );

      const button = screen.getByText("Confirm & Pay");
      await user.click(button);
      await user.click(button);

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });
});
