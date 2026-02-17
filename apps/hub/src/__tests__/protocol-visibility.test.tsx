import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProtocolInspector } from "@/components/features/protocol-inspector";
import { useUiStore } from "@/stores/ui-store";
import type { Order } from "@/stores/order-store";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let mockEvents: { id: string; type: string; payload: unknown; receivedAt: Date }[] = [];
let mockTransitions: { from: string | null; to: string; timestamp: Date }[] = [];

vi.mock("@/hooks/use-protocol-events", () => ({
  useProtocolEvents: () => ({
    events: mockEvents,
    transitions: mockTransitions,
    clearEvents: vi.fn(),
  }),
}));

vi.mock("wagmi", () => ({
  useChainId: () => 84532,
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => (
    <span>{children}</span>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const FULL_ORDER: Order = {
  orderId: "ord_vis_test_001",
  serviceType: "text_echo",
  priceUsdc: "5.00",
  providerAddress: "0x1234567890abcdef1234567890abcdef12345678",
  status: "delivered",
  createdAt: Date.now(),
  txHash: "0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1",
  signedMessage: "IVXP/1.0 order ord_vis_test_001",
  signature: "0xsig_verified_abc123",
  signatureVerified: true,
  contentHash: "sha256:abcdef1234567890abcdef1234567890",
};

// ---------------------------------------------------------------------------
// Tests -- Protocol Visibility Acceptance Criteria
// ---------------------------------------------------------------------------

describe("Protocol Visibility - Acceptance Criteria", () => {
  beforeEach(() => {
    useUiStore.getState().setInspectorOpen(true);
    mockEvents = [];
    mockTransitions = [
      { from: null, to: "quoted", timestamp: new Date() },
      { from: "quoted", to: "paid", timestamp: new Date() },
      { from: "paid", to: "processing", timestamp: new Date() },
      { from: "processing", to: "delivered", timestamp: new Date() },
    ];
  });

  // AC #1: user can easily see order_id displayed
  describe("AC #1: order_id visibility", () => {
    it("displays order_id prominently in Protocol Inspector", () => {
      render(<ProtocolInspector order={FULL_ORDER} />);
      expect(screen.getByText("ord_vis_test_001")).toBeInTheDocument();
    });

    it("has copy button for order_id", () => {
      render(<ProtocolInspector order={FULL_ORDER} />);
      expect(screen.getByRole("button", { name: /copy order_id/i })).toBeInTheDocument();
    });
  });

  // AC #2: user can see tx_hash with link to block explorer
  describe("AC #2: tx_hash with block explorer link", () => {
    it("displays tx_hash in Protocol Inspector", () => {
      render(<ProtocolInspector order={FULL_ORDER} />);
      const txElements = screen.getAllByText(/0xabc123def456/);
      expect(txElements.length).toBeGreaterThanOrEqual(1);
    });

    it("links tx_hash to BaseScan explorer", () => {
      render(<ProtocolInspector order={FULL_ORDER} />);
      const link = screen.getByRole("link", { name: /view on explorer/i });
      expect(link).toHaveAttribute("href", `https://sepolia.basescan.org/tx/${FULL_ORDER.txHash}`);
      expect(link).toHaveAttribute("target", "_blank");
    });

    it("has copy button for tx_hash", () => {
      render(<ProtocolInspector order={FULL_ORDER} />);
      expect(screen.getByRole("button", { name: /copy tx_hash/i })).toBeInTheDocument();
    });
  });

  // AC #3: user can see signature value with verification indicator
  describe("AC #3: signature with verification indicator", () => {
    it("displays signature value", () => {
      render(<ProtocolInspector order={FULL_ORDER} />);
      expect(screen.getByText("0xsig_verified_abc123")).toBeInTheDocument();
    });

    it("shows verification badge for signature", () => {
      render(<ProtocolInspector order={FULL_ORDER} />);
      const badge = screen.getByTestId("verified-signature");
      expect(badge).toBeInTheDocument();
      expect(badge.textContent).toContain("Verified");
    });

    it("has copy button for signature", () => {
      render(<ProtocolInspector order={FULL_ORDER} />);
      expect(screen.getByRole("button", { name: /copy signature/i })).toBeInTheDocument();
    });
  });

  // AC #4: user can see order status transitions
  describe("AC #4: order status transitions", () => {
    it("shows state machine with all transitions", () => {
      render(<ProtocolInspector order={FULL_ORDER} />);
      expect(screen.getByText(/state machine/i)).toBeInTheDocument();
      expect(screen.getByTestId("state-delivered")).toHaveAttribute("data-active", "true");
    });

    it("shows all state nodes in the machine", () => {
      render(<ProtocolInspector order={FULL_ORDER} />);
      expect(screen.getByTestId("state-quoted")).toBeInTheDocument();
      expect(screen.getByTestId("state-paid")).toBeInTheDocument();
      expect(screen.getByTestId("state-processing")).toBeInTheDocument();
      expect(screen.getByTestId("state-delivered")).toBeInTheDocument();
    });
  });

  // AC #5: user can see content_hash of deliverable
  describe("AC #5: content_hash visibility", () => {
    it("displays content_hash in Protocol Inspector", () => {
      render(<ProtocolInspector order={FULL_ORDER} />);
      expect(screen.getByText("sha256:abcdef1234567890abcdef1234567890")).toBeInTheDocument();
    });

    it("has copy button for content_hash", () => {
      render(<ProtocolInspector order={FULL_ORDER} />);
      expect(screen.getByRole("button", { name: /copy content_hash/i })).toBeInTheDocument();
    });
  });

  // AC #6: all protocol data is clearly labeled and explained
  describe("AC #6: clear labeling and educational tooltips", () => {
    it("labels all protocol fields", () => {
      render(<ProtocolInspector order={FULL_ORDER} />);
      const panel = screen.getByTestId("inspector-panel");
      expect(panel.textContent).toContain("order_id");
      expect(panel.textContent).toContain("tx_hash");
      expect(panel.textContent).toContain("signed_message");
      expect(panel.textContent).toContain("signature");
      expect(panel.textContent).toContain("content_hash");
      expect(panel.textContent).toContain("status");
      expect(panel.textContent).toContain("provider");
    });

    it("includes educational tooltip triggers for protocol fields", () => {
      render(<ProtocolInspector order={FULL_ORDER} />);
      // Tooltip triggers render info icons with aria-labels
      const tooltipTriggers = screen.getAllByLabelText(/learn about/i);
      expect(tooltipTriggers.length).toBeGreaterThanOrEqual(5);
    });

    it("shows section headers for organization", () => {
      render(<ProtocolInspector order={FULL_ORDER} />);
      expect(screen.getByText("Protocol Fields")).toBeInTheDocument();
      expect(screen.getByText("State Machine")).toBeInTheDocument();
      expect(screen.getByText("Event Log")).toBeInTheDocument();
      const rawHeaders = screen.getAllByText("Raw Wire Format");
      expect(rawHeaders.length).toBeGreaterThanOrEqual(1);
    });
  });
});
