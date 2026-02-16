import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProtocolInspector } from "./index";
import { useUiStore } from "@/stores/ui-store";
import type { Order } from "@/stores/order-store";

// ---------------------------------------------------------------------------
// Mock hooks
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

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const MOCK_ORDER: Order = {
  orderId: "ord_test_abc",
  serviceType: "text_echo",
  priceUsdc: "5.00",
  providerAddress: "0x1234567890abcdef1234567890abcdef12345678",
  status: "paid",
  createdAt: new Date("2025-06-01T00:00:00Z").getTime(),
  txHash: "0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1",
  signedMessage: "IVXP/1.0 order ord_test_abc",
  signature: "0xsig123abc456def789",
  contentHash: "sha256:abcdef1234567890",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ProtocolInspector", () => {
  beforeEach(() => {
    useUiStore.getState().setInspectorOpen(false);
    mockEvents = [];
    mockTransitions = [];
  });

  it("renders toggle button with correct aria-label when closed", () => {
    render(<ProtocolInspector order={MOCK_ORDER} />);
    expect(screen.getByRole("button", { name: /open protocol inspector/i })).toBeInTheDocument();
  });

  it("panel is collapsed by default", () => {
    render(<ProtocolInspector order={MOCK_ORDER} />);
    expect(screen.queryByTestId("inspector-panel")).not.toBeInTheDocument();
  });

  it("opens panel when toggle is clicked", () => {
    render(<ProtocolInspector order={MOCK_ORDER} />);
    fireEvent.click(screen.getByRole("button", { name: /open protocol inspector/i }));
    expect(screen.getByTestId("inspector-panel")).toBeInTheDocument();
  });

  it("displays protocol fields when open", () => {
    useUiStore.getState().setInspectorOpen(true);
    render(<ProtocolInspector order={MOCK_ORDER} />);

    expect(screen.getByText("ord_test_abc")).toBeInTheDocument();
    // tx_hash appears in both CopyField and raw JSON, so use getAllByText
    const txElements = screen.getAllByText(/0xabc123def456/);
    expect(txElements.length).toBeGreaterThanOrEqual(1);
  });

  it("persists open state via ui-store", () => {
    useUiStore.getState().setInspectorOpen(true);
    render(<ProtocolInspector order={MOCK_ORDER} />);
    expect(screen.getByTestId("inspector-panel")).toBeInTheDocument();
  });

  it("closes panel when toggle is clicked again", () => {
    useUiStore.getState().setInspectorOpen(true);
    render(<ProtocolInspector order={MOCK_ORDER} />);

    fireEvent.click(screen.getByRole("button", { name: /close protocol inspector/i }));
    expect(screen.queryByTestId("inspector-panel")).not.toBeInTheDocument();
  });

  it("renders block explorer link for tx_hash", () => {
    useUiStore.getState().setInspectorOpen(true);
    render(<ProtocolInspector order={MOCK_ORDER} />);

    const link = screen.getByRole("link", { name: /view on explorer/i });
    expect(link).toHaveAttribute("href", `https://sepolia.basescan.org/tx/${MOCK_ORDER.txHash}`);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders copy buttons for copiable fields", () => {
    useUiStore.getState().setInspectorOpen(true);
    render(<ProtocolInspector order={MOCK_ORDER} />);

    const copyButtons = screen.getAllByRole("button", { name: /copy/i });
    expect(copyButtons.length).toBeGreaterThanOrEqual(2);
  });

  it("shows raw wire format JSON section", () => {
    useUiStore.getState().setInspectorOpen(true);
    render(<ProtocolInspector order={MOCK_ORDER} />);

    // snake_case keys should appear in the panel content (raw JSON section)
    const panelContent = screen.getByTestId("inspector-panel").textContent ?? "";
    expect(panelContent).toContain("Raw Wire Format");
    expect(panelContent).toContain("order_id");
    expect(panelContent).toContain("tx_hash");
  });

  it("shows empty event log when no events", () => {
    useUiStore.getState().setInspectorOpen(true);
    render(<ProtocolInspector order={MOCK_ORDER} />);

    expect(screen.getByText(/no events yet/i)).toBeInTheDocument();
  });

  it("renders events in event log", () => {
    useUiStore.getState().setInspectorOpen(true);
    mockEvents.push({
      id: "evt-1",
      type: "order.quoted",
      payload: { orderId: "ord_test_abc" },
      receivedAt: new Date(),
    });

    render(<ProtocolInspector order={MOCK_ORDER} />);
    expect(screen.getByText("order.quoted")).toBeInTheDocument();
  });

  it("renders state machine visualization", () => {
    useUiStore.getState().setInspectorOpen(true);
    render(<ProtocolInspector order={MOCK_ORDER} />);

    expect(screen.getByText(/state machine/i)).toBeInTheDocument();
    // Current status should be highlighted
    expect(screen.getByTestId("state-paid")).toHaveAttribute("data-active", "true");
  });

  it("displays signed_message, signature, and content_hash fields", () => {
    useUiStore.getState().setInspectorOpen(true);
    render(<ProtocolInspector order={MOCK_ORDER} />);

    expect(screen.getByText("IVXP/1.0 order ord_test_abc")).toBeInTheDocument();
    expect(screen.getByText("0xsig123abc456def789")).toBeInTheDocument();
    expect(screen.getByText("sha256:abcdef1234567890")).toBeInTheDocument();
  });

  it("hides optional fields when not present on order", () => {
    const orderWithoutOptionals: Order = {
      ...MOCK_ORDER,
      txHash: undefined,
      signedMessage: undefined,
      signature: undefined,
      contentHash: undefined,
    };
    useUiStore.getState().setInspectorOpen(true);
    render(<ProtocolInspector order={orderWithoutOptionals} />);

    // These fields should not render CopyField rows
    expect(screen.queryByText("IVXP/1.0 order ord_test_abc")).not.toBeInTheDocument();
    expect(screen.queryByText("0xsig123abc456def789")).not.toBeInTheDocument();
    expect(screen.queryByText("sha256:abcdef1234567890")).not.toBeInTheDocument();
    // Explorer link should not appear
    expect(screen.queryByRole("link", { name: /view on explorer/i })).not.toBeInTheDocument();
  });

  it("includes new fields in raw wire format JSON", () => {
    useUiStore.getState().setInspectorOpen(true);
    render(<ProtocolInspector order={MOCK_ORDER} />);

    const panelContent = screen.getByTestId("inspector-panel").textContent ?? "";
    expect(panelContent).toContain("signed_message");
    expect(panelContent).toContain("content_hash");
  });

  it("renders out-of-order events without errors", () => {
    useUiStore.getState().setInspectorOpen(true);
    mockEvents.push(
      {
        id: "evt-1",
        type: "order.delivered",
        payload: { orderId: "ord_test_abc" },
        receivedAt: new Date(),
      },
      {
        id: "evt-2",
        type: "order.quoted",
        payload: { orderId: "ord_test_abc" },
        receivedAt: new Date(),
      },
      {
        id: "evt-3",
        type: "payment.sent",
        payload: { txHash: "0x123" },
        receivedAt: new Date(),
      },
    );

    render(<ProtocolInspector order={MOCK_ORDER} />);
    expect(screen.getByText("order.delivered")).toBeInTheDocument();
    expect(screen.getByText("order.quoted")).toBeInTheDocument();
    expect(screen.getByText("payment.sent")).toBeInTheDocument();
  });

  it("renders state transitions with timestamps", () => {
    useUiStore.getState().setInspectorOpen(true);
    mockTransitions.push(
      { from: null, to: "quoted", timestamp: new Date() },
      { from: "quoted", to: "paid", timestamp: new Date() },
    );

    render(<ProtocolInspector order={MOCK_ORDER} />);
    // State machine section should be present with transitions
    expect(screen.getByTestId("state-quoted")).toBeInTheDocument();
    expect(screen.getByTestId("state-paid")).toBeInTheDocument();
  });
});
