import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProtocolTooltip, PROTOCOL_TOOLTIPS } from "./protocol-tooltip";

// ---------------------------------------------------------------------------
// Mock the tooltip UI component (avoids Radix portal issues in jsdom)
// ---------------------------------------------------------------------------

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => (
    <span data-testid="tooltip-trigger">{children}</span>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ProtocolTooltip", () => {
  it("renders info icon trigger for order_id", () => {
    render(<ProtocolTooltip field="order_id" />);
    const trigger = screen.getByLabelText(/learn about order id/i);
    expect(trigger).toBeInTheDocument();
  });

  it("renders tooltip content with correct description", () => {
    render(<ProtocolTooltip field="tx_hash" />);
    expect(screen.getByText(PROTOCOL_TOOLTIPS.tx_hash)).toBeInTheDocument();
  });

  it("renders all defined tooltip fields", () => {
    const fields = Object.keys(PROTOCOL_TOOLTIPS) as Array<keyof typeof PROTOCOL_TOOLTIPS>;
    for (const field of fields) {
      const { unmount } = render(<ProtocolTooltip field={field} />);
      expect(screen.getByText(PROTOCOL_TOOLTIPS[field])).toBeInTheDocument();
      unmount();
    }
  });

  it("renders custom children as trigger", () => {
    render(
      <ProtocolTooltip field="signature">
        <button type="button">Custom trigger</button>
      </ProtocolTooltip>,
    );
    expect(screen.getByText("Custom trigger")).toBeInTheDocument();
  });
});
