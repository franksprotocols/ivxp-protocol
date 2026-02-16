import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrderDetail } from "./order-detail";
import type { Order } from "@/stores/order-store";

const BASE_ORDER: Order = {
  orderId: "ord_test_abc",
  serviceType: "text_echo",
  priceUsdc: "2.50",
  providerAddress: "0x1234567890abcdef1234567890abcdef12345678",
  status: "processing",
  createdAt: new Date("2025-06-01T10:00:00Z").getTime(),
  updatedAt: new Date("2025-06-01T10:05:00Z").getTime(),
  txHash: "0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1",
};

describe("OrderDetail", () => {
  it("renders order ID", () => {
    render(<OrderDetail order={BASE_ORDER} isPolling={true} />);
    expect(screen.getByText("ord_test_abc")).toBeInTheDocument();
  });

  it("renders service type", () => {
    render(<OrderDetail order={BASE_ORDER} isPolling={true} />);
    expect(screen.getByText("Text Echo")).toBeInTheDocument();
  });

  it("renders price in USDC", () => {
    render(<OrderDetail order={BASE_ORDER} isPolling={true} />);
    expect(screen.getByText("2.50 USDC")).toBeInTheDocument();
  });

  it("renders status badge", () => {
    render(<OrderDetail order={BASE_ORDER} isPolling={true} />);
    expect(screen.getByTestId("status-badge")).toBeInTheDocument();
  });

  it("renders tx_hash as a block explorer link", () => {
    render(<OrderDetail order={BASE_ORDER} isPolling={true} />);

    const link = screen.getByRole("link", { name: /view transaction/i });
    expect(link).toHaveAttribute("href", expect.stringContaining("/tx/0xabc123"));
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("does not render tx link when txHash is absent", () => {
    const orderWithoutTx = { ...BASE_ORDER, txHash: undefined };
    render(<OrderDetail order={orderWithoutTx} isPolling={true} />);

    expect(screen.queryByRole("link", { name: /view transaction/i })).not.toBeInTheDocument();
  });

  it("renders timestamps", () => {
    render(<OrderDetail order={BASE_ORDER} isPolling={true} />);

    expect(screen.getByText(/created/i)).toBeInTheDocument();
    expect(screen.getByText(/updated/i)).toBeInTheDocument();
  });

  it("renders progress stepper", () => {
    render(<OrderDetail order={BASE_ORDER} isPolling={true} />);

    expect(screen.getByLabelText("Order progress")).toBeInTheDocument();
  });

  it("shows Download button when status is delivered", () => {
    const deliveredOrder = { ...BASE_ORDER, status: "delivered" as const };
    render(<OrderDetail order={deliveredOrder} isPolling={false} />);

    expect(screen.getByRole("button", { name: /download/i })).toBeInTheDocument();
  });

  it("does not show Download button for non-delivered status", () => {
    render(<OrderDetail order={BASE_ORDER} isPolling={true} />);

    expect(screen.queryByRole("button", { name: /download/i })).not.toBeInTheDocument();
  });

  it("shows error details when status is delivery_failed", () => {
    const failedOrder = {
      ...BASE_ORDER,
      status: "delivery_failed" as const,
      errorMessage: "Provider timeout exceeded",
    };
    render(<OrderDetail order={failedOrder} isPolling={false} />);

    expect(screen.getByText("Provider timeout exceeded")).toBeInTheDocument();
  });

  it("shows generic error message when delivery_failed without errorMessage", () => {
    const failedOrder = { ...BASE_ORDER, status: "delivery_failed" as const };
    render(<OrderDetail order={failedOrder} isPolling={false} />);

    expect(screen.getByText(/an error occurred during delivery/i)).toBeInTheDocument();
  });

  it("shows polling indicator when isPolling is true", () => {
    render(<OrderDetail order={BASE_ORDER} isPolling={true} />);

    expect(screen.getByText(/auto-refreshing/i)).toBeInTheDocument();
  });
});
