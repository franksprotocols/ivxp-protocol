import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
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
    vi.useFakeTimers();
    vi.clearAllMocks();
    useOrderStore.getState().clearOrders();
  });

  afterEach(() => {
    vi.useRealTimers();
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

    const { result } = renderHook(() => useOrderStatus(MOCK_ORDER.orderId));
    expect(result.current.isPolling).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(1500);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(useOrderStore.getState().getOrder(MOCK_ORDER.orderId)?.status).toBe("processing");
    });

    await act(async () => {
      vi.advanceTimersByTime(2500);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(useOrderStore.getState().getOrder(MOCK_ORDER.orderId)?.status).toBe("delivered");
      expect(result.current.isPolling).toBe(false);
    });

    expect(mockGetOrderStatus).toHaveBeenCalledWith(
      "http://provider.test:3001",
      MOCK_ORDER.orderId,
    );
  });

  it("keeps previous status for unknown provider statuses", async () => {
    useOrderStore.getState().addOrder(MOCK_ORDER);
    mockGetOrderStatus.mockResolvedValue({ order_id: MOCK_ORDER.orderId, status: "queued_custom" });

    renderHook(() => useOrderStatus(MOCK_ORDER.orderId));

    await act(async () => {
      vi.advanceTimersByTime(1500);
      await Promise.resolve();
    });

    expect(useOrderStore.getState().getOrder(MOCK_ORDER.orderId)?.status).toBe("paid");
  });

  it("surfaces polling errors and continues retries", async () => {
    useOrderStore.getState().addOrder(MOCK_ORDER);
    mockGetOrderStatus
      .mockRejectedValueOnce(new Error("Provider timeout"))
      .mockResolvedValueOnce({ order_id: MOCK_ORDER.orderId, status: "processing" });

    const { result } = renderHook(() => useOrderStatus(MOCK_ORDER.orderId));

    await act(async () => {
      vi.advanceTimersByTime(1500);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.error).toContain("Provider timeout");
    });

    await act(async () => {
      vi.advanceTimersByTime(2500);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(useOrderStore.getState().getOrder(MOCK_ORDER.orderId)?.status).toBe("processing");
    });
  });
});
