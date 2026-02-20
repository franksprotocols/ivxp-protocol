import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useOrderStatus, getBackoffInterval } from "./use-order-status";
import { useOrderStore, type Order } from "@/stores/order-store";

const mockGetOrderStatus = vi.fn();

vi.mock("./use-ivxp-client", () => ({
  useIVXPClient: () => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    requestQuote: vi.fn(),
    requestDelivery: vi.fn(),
    getOrderStatus: mockGetOrderStatus,
    downloadDeliverable: vi.fn(),
  }),
}));

const MOCK_ORDER: Order = {
  orderId: "ord_test_123",
  serviceType: "text_echo",
  priceUsdc: "1.00",
  providerAddress: "0x1234567890abcdef1234567890abcdef12345678",
  providerEndpointUrl: "http://provider.test:3001",
  status: "paid",
  createdAt: new Date("2025-01-01T00:00:00Z").getTime(),
  txHash: "0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1",
};

describe("getBackoffInterval", () => {
  it("returns ~1000ms for attempt 0 with no jitter", () => {
    const interval = getBackoffInterval(0, () => 0.5);
    expect(interval).toBe(1000);
  });

  it("doubles interval for each attempt", () => {
    const noJitter = () => 0.5;
    expect(getBackoffInterval(0, noJitter)).toBe(1000);
    expect(getBackoffInterval(1, noJitter)).toBe(2000);
    expect(getBackoffInterval(2, noJitter)).toBe(4000);
  });
});

describe("useOrderStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useOrderStore.getState().clearOrders();
  });

  afterEach(() => {
    useOrderStore.getState().clearOrders();
  });

  it("returns null order and no polling when order not found", () => {
    const { result } = renderHook(() => useOrderStatus("nonexistent"));

    expect(result.current.order).toBeNull();
    expect(result.current.isPolling).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("polls provider status and updates store until terminal status", async () => {
    useOrderStore.getState().addOrder(MOCK_ORDER);
    mockGetOrderStatus
      .mockResolvedValueOnce({ order_id: MOCK_ORDER.orderId, status: "processing" })
      .mockResolvedValueOnce({ order_id: MOCK_ORDER.orderId, status: "delivered" });

    const { result, unmount } = renderHook(() => useOrderStatus(MOCK_ORDER.orderId));
    expect(result.current.isPolling).toBe(true);

    await waitFor(
      () => {
        expect(useOrderStore.getState().getOrder(MOCK_ORDER.orderId)?.status).toBe("processing");
      },
      { timeout: 3_000 },
    );

    await waitFor(
      () => {
        expect(useOrderStore.getState().getOrder(MOCK_ORDER.orderId)?.status).toBe("delivered");
        expect(result.current.isPolling).toBe(false);
      },
      { timeout: 6_000 },
    );

    expect(mockGetOrderStatus).toHaveBeenCalledWith(
      "http://provider.test:3001",
      MOCK_ORDER.orderId,
    );
    unmount();
  });

  it("keeps previous status for unknown provider statuses", async () => {
    useOrderStore.getState().addOrder(MOCK_ORDER);
    mockGetOrderStatus.mockResolvedValue({ order_id: MOCK_ORDER.orderId, status: "queued_custom" });

    const { unmount } = renderHook(() => useOrderStatus(MOCK_ORDER.orderId));

    await waitFor(
      () => {
        expect(mockGetOrderStatus).toHaveBeenCalledTimes(1);
      },
      { timeout: 3_000 },
    );

    expect(useOrderStore.getState().getOrder(MOCK_ORDER.orderId)?.status).toBe("paid");
    unmount();
  });

  it("surfaces polling errors and continues retries", async () => {
    useOrderStore.getState().addOrder(MOCK_ORDER);
    mockGetOrderStatus
      .mockRejectedValueOnce(new Error("Provider timeout"))
      .mockResolvedValueOnce({ order_id: MOCK_ORDER.orderId, status: "processing" });

    const { result, unmount } = renderHook(() => useOrderStatus(MOCK_ORDER.orderId));

    await waitFor(
      () => {
        expect(typeof result.current.error).toBe("string");
        expect(result.current.error).toContain("Provider timeout");
      },
      { timeout: 3_000 },
    );

    await waitFor(
      () => {
        expect(useOrderStore.getState().getOrder(MOCK_ORDER.orderId)?.status).toBe("processing");
      },
      { timeout: 6_000 },
    );
    unmount();
  });
});
