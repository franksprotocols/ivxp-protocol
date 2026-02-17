import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, act } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { OrderList } from "./order-list";
import { useOrderStore } from "@/stores/order-store";
import type { Order } from "@/stores/order-store";

vi.mock("wagmi", async () => {
  const actual = await vi.importActual("wagmi");
  return {
    ...actual,
    useAccount: vi.fn(),
  };
});

import { useAccount } from "wagmi";

const mockUseAccount = vi.mocked(useAccount);

const MOCK_ORDERS: readonly Order[] = [
  {
    orderId: "ord_older_one",
    serviceType: "text_echo",
    priceUsdc: "1.00",
    providerAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    clientAddress: "0x1234567890abcdef1234567890abcdef12345678",
    status: "delivered",
    createdAt: new Date("2025-05-01T10:00:00Z").getTime(),
  },
  {
    orderId: "ord_newer_one",
    serviceType: "image_gen",
    priceUsdc: "5.00",
    providerAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    clientAddress: "0x1234567890abcdef1234567890abcdef12345678",
    status: "processing",
    createdAt: new Date("2025-06-15T10:00:00Z").getTime(),
  },
];

function setupConnected(orders: readonly Order[] = []) {
  mockUseAccount.mockReturnValue({
    isConnected: true,
    address: "0x1234567890abcdef1234567890abcdef12345678",
  } as unknown as ReturnType<typeof useAccount>);

  const store = useOrderStore.getState();
  store.clearOrders();
  for (const order of orders) {
    store.addOrder(order);
  }
}

function setupDisconnected() {
  mockUseAccount.mockReturnValue({
    isConnected: false,
    address: undefined,
  } as unknown as ReturnType<typeof useAccount>);

  useOrderStore.getState().clearOrders();
}

describe("OrderList", () => {
  beforeEach(() => {
    useOrderStore.getState().clearOrders();
  });

  it("renders order cards when wallet is connected and orders exist", async () => {
    setupConnected(MOCK_ORDERS);
    renderWithProviders(<OrderList />);

    await waitFor(() => {
      expect(screen.getByText("Text Echo")).toBeInTheDocument();
    });
    expect(screen.getByText("Image Gen")).toBeInTheDocument();
  });

  it("renders orders sorted by date (newest first)", async () => {
    setupConnected(MOCK_ORDERS);
    renderWithProviders(<OrderList />);

    await waitFor(() => {
      expect(screen.getAllByRole("link")).toHaveLength(2);
    });

    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveAttribute("href", "/orders/ord_newer_one");
    expect(links[1]).toHaveAttribute("href", "/orders/ord_older_one");
  });

  it("shows empty state when connected but no orders", async () => {
    setupConnected([]);
    renderWithProviders(<OrderList />);

    await waitFor(() => {
      expect(screen.getByText("No orders yet.")).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /browse the marketplace/i })).toHaveAttribute(
      "href",
      "/marketplace",
    );
  });

  it("shows connect wallet prompt when disconnected", () => {
    setupDisconnected();
    renderWithProviders(<OrderList />);

    expect(screen.getByText("Connect wallet to view orders")).toBeInTheDocument();
  });

  it("does not show order cards when disconnected", () => {
    setupDisconnected();
    renderWithProviders(<OrderList />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows loading skeleton while fetching", () => {
    setupConnected([]);
    useOrderStore.setState({ isLoading: true });
    renderWithProviders(<OrderList />);

    expect(screen.getAllByTestId("order-skeleton")).toHaveLength(3);
  });

  it("calls fetchOrders with wallet address on mount", () => {
    setupConnected([]);
    const fetchSpy = vi.spyOn(useOrderStore.getState(), "fetchOrders");
    renderWithProviders(<OrderList />);

    expect(fetchSpy).toHaveBeenCalledWith("0x1234567890abcdef1234567890abcdef12345678");
    fetchSpy.mockRestore();
  });

  it("clears loading state after fetch completes", async () => {
    setupConnected([]);
    renderWithProviders(<OrderList />);

    // Initially shows loading skeleton
    expect(screen.getAllByTestId("order-skeleton")).toHaveLength(3);

    // After fetch resolves, loading clears and empty state appears
    await waitFor(() => {
      expect(screen.getByText("No orders yet.")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("order-skeleton")).not.toBeInTheDocument();
  });

  it("shows error state with retry button when fetch fails", async () => {
    setupConnected([]);
    renderWithProviders(<OrderList />);

    // Wait for fetch to complete, then simulate error state
    await waitFor(() => {
      expect(useOrderStore.getState().isLoading).toBe(false);
    });

    act(() => {
      useOrderStore.setState({ error: "Network timeout", isLoading: false });
    });

    await waitFor(() => {
      expect(screen.getByText("Failed to load orders")).toBeInTheDocument();
    });
    expect(screen.getByText("Network timeout")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
