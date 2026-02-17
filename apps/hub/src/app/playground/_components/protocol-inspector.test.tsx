import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProtocolInspector } from "./protocol-inspector";
import type { ProtocolEvent, StateTransition } from "@/hooks/use-protocol-events";
import type { ExecutionResult } from "./service-tester";

const mockEvents: readonly ProtocolEvent[] = [
  {
    id: "order.quoted-1",
    type: "order.quoted",
    payload: { orderId: "order_1", priceUsdc: "0.50" },
    receivedAt: new Date("2026-01-01T12:00:00Z"),
  },
  {
    id: "payment.sent-1",
    type: "payment.sent",
    payload: { orderId: "order_1", txHash: "0xabc" },
    receivedAt: new Date("2026-01-01T12:00:01Z"),
  },
];

const mockTransitions: readonly StateTransition[] = [
  { from: null, to: "quoting", timestamp: new Date("2026-01-01T12:00:00Z") },
  { from: "quoting", to: "paying", timestamp: new Date("2026-01-01T12:00:01Z") },
];

const mockResult: ExecutionResult = {
  orderId: "order_123",
  txHash: "0xdeadbeef",
  signature: "0xsig123",
  contentHash: "0xhash456",
  deliverable: { result: "test" },
  phase: "complete",
};

describe("ProtocolInspector", () => {
  it("renders the protocol inspector card", () => {
    render(<ProtocolInspector events={[]} transitions={[]} result={null} onClear={vi.fn()} />);
    expect(screen.getByTestId("protocol-inspector")).toBeInTheDocument();
  });

  it("shows empty state when no events", () => {
    render(<ProtocolInspector events={[]} transitions={[]} result={null} onClear={vi.fn()} />);
    expect(
      screen.getByText("No events yet. Execute a service to see protocol internals."),
    ).toBeInTheDocument();
  });

  it("displays event count badge when events exist", () => {
    render(
      <ProtocolInspector events={mockEvents} transitions={[]} result={null} onClear={vi.fn()} />,
    );
    expect(screen.getByTestId("event-count")).toHaveTextContent("2");
  });

  it("displays protocol details when result is available", () => {
    render(
      <ProtocolInspector
        events={mockEvents}
        transitions={mockTransitions}
        result={mockResult}
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByTestId("protocol-details")).toBeInTheDocument();
    expect(screen.getByText("order_123")).toBeInTheDocument();
    expect(screen.getByText("0xdeadbeef")).toBeInTheDocument();
    expect(screen.getByText("0xsig123")).toBeInTheDocument();
    expect(screen.getByText("0xhash456")).toBeInTheDocument();
  });

  it("displays state machine transitions", () => {
    render(
      <ProtocolInspector
        events={mockEvents}
        transitions={mockTransitions}
        result={null}
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByTestId("state-transitions")).toBeInTheDocument();
    expect(screen.getByText("quoting")).toBeInTheDocument();
    expect(screen.getByText("paying")).toBeInTheDocument();
  });

  it("displays events in the event stream", () => {
    render(
      <ProtocolInspector events={mockEvents} transitions={[]} result={null} onClear={vi.fn()} />,
    );
    expect(screen.getByTestId("event-order.quoted")).toBeInTheDocument();
    expect(screen.getByTestId("event-payment.sent")).toBeInTheDocument();
  });

  it("has accessible event stream with role=log and aria-live", () => {
    render(
      <ProtocolInspector events={mockEvents} transitions={[]} result={null} onClear={vi.fn()} />,
    );
    const eventLog = screen.getByRole("log");
    expect(eventLog).toHaveAttribute("aria-live", "polite");
    expect(eventLog).toHaveAttribute("aria-label", "Protocol events");
    expect(eventLog).toHaveAttribute("tabindex", "0");
  });

  it("calls onClear when clear button is clicked", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(
      <ProtocolInspector events={mockEvents} transitions={[]} result={null} onClear={onClear} />,
    );

    await user.click(screen.getByTestId("clear-events"));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("collapses and expands when toggle is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ProtocolInspector events={mockEvents} transitions={[]} result={null} onClear={vi.fn()} />,
    );

    // Initially expanded
    expect(screen.getByTestId("event-stream")).toBeInTheDocument();

    // Collapse
    await user.click(screen.getByTestId("toggle-inspector"));
    expect(screen.queryByTestId("event-stream")).not.toBeInTheDocument();

    // Expand again
    await user.click(screen.getByTestId("toggle-inspector"));
    expect(screen.getByTestId("event-stream")).toBeInTheDocument();
  });
});
