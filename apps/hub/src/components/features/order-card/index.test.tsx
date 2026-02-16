import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrderCard } from "./index";
import type { Order } from "@/stores/order-store";

const BASE_ORDER: Order = {
  orderId: "ord_abc123def456ghi789",
  serviceType: "text_echo",
  priceUsdc: "2.50",
  providerAddress: "0x1234567890abcdef1234567890abcdef12345678",
  status: "processing",
  createdAt: new Date("2025-06-01T10:00:00Z").getTime(),
};

function createOrder(overrides: Partial<Order> = {}): Order {
  return { ...BASE_ORDER, ...overrides };
}

describe("OrderCard", () => {
  it("renders truncated order ID", () => {
    render(<OrderCard order={createOrder()} />);
    expect(screen.getByText("ord_abc1...i789")).toBeInTheDocument();
  });

  it("renders formatted service type", () => {
    render(<OrderCard order={createOrder()} />);
    expect(screen.getByText("Text Echo")).toBeInTheDocument();
  });

  it("renders price in USDC", () => {
    render(<OrderCard order={createOrder()} />);
    expect(screen.getByText("2.50 USDC")).toBeInTheDocument();
  });

  it("renders status badge", () => {
    render(<OrderCard order={createOrder()} />);
    const badge = screen.getByTestId("order-status-badge");
    expect(badge).toHaveTextContent("Processing");
  });

  it("renders formatted date", () => {
    render(<OrderCard order={createOrder()} />);
    // The date should be rendered in some human-readable format
    expect(screen.getByTestId("order-date")).toBeInTheDocument();
  });

  it("links to order detail page", () => {
    render(<OrderCard order={createOrder()} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/orders/ord_abc123def456ghi789");
  });

  it("has descriptive aria-label on link", () => {
    render(<OrderCard order={createOrder()} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("aria-label", "View order ord_abc1...i789 - Text Echo");
  });

  it.each([
    ["quoted", "Quoted"],
    ["paying", "Paying"],
    ["paid", "Paid"],
    ["processing", "Processing"],
    ["delivered", "Delivered"],
    ["failed", "Failed"],
    ["delivery_failed", "Delivery Failed"],
  ] as const)("renders %s status as %s", (status, label) => {
    render(<OrderCard order={createOrder({ status })} />);
    expect(screen.getByTestId("order-status-badge")).toHaveTextContent(label);
  });

  it("renders short order ID for short IDs", () => {
    render(<OrderCard order={createOrder({ orderId: "abc" })} />);
    expect(screen.getByText("abc")).toBeInTheDocument();
  });
});
