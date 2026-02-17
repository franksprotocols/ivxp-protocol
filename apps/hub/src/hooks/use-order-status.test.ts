import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useOrderStatus, getBackoffInterval } from "./use-order-status";
import { useOrderStore } from "@/stores/order-store";
import type { Order } from "@/stores/order-store";

const MOCK_ORDER: Order = {
  orderId: "ord_test_123",
  serviceType: "text_echo",
  priceUsdc: "1.00",
  providerAddress: "0x1234567890abcdef1234567890abcdef12345678",
  status: "paid",
  createdAt: new Date("2025-01-01T00:00:00Z").getTime(),
  txHash: "0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1",
};

describe("getBackoffInterval", () => {
  it("returns ~1000ms for attempt 0 with no jitter", () => {
    // random() returning 0.5 produces zero jitter: (0.5 * 2 - 1) = 0
    const interval = getBackoffInterval(0, () => 0.5);
    expect(interval).toBe(1000);
  });

  it("doubles interval for each attempt", () => {
    const noJitter = () => 0.5;
    expect(getBackoffInterval(0, noJitter)).toBe(1000);
    expect(getBackoffInterval(1, noJitter)).toBe(2000);
    expect(getBackoffInterval(2, noJitter)).toBe(4000);
    expect(getBackoffInterval(3, noJitter)).toBe(8000);
  });

  it("caps at MAX_INTERVAL_MS (30s)", () => {
    const noJitter = () => 0.5;
    // attempt 5 = 32000 > 30000, should cap
    expect(getBackoffInterval(5, noJitter)).toBe(30000);
    expect(getBackoffInterval(10, noJitter)).toBe(30000);
  });

  it("applies jitter within expected range", () => {
    // random() = 0 => jitter factor = (0*2-1) = -1 => max negative jitter
    const minJitter = getBackoffInterval(0, () => 0);
    // random() = 1 => jitter factor = (1*2-1) = 1 => max positive jitter
    const maxJitter = getBackoffInterval(0, () => 1);

    // base=1000, jitter=20%, so range is [800, 1200]
    // but floor is INITIAL_INTERVAL_MS=1000, so min is clamped to 1000
    expect(minJitter).toBeGreaterThanOrEqual(800);
    expect(maxJitter).toBeLessThanOrEqual(1200);
  });

  it("never returns less than INITIAL_INTERVAL_MS", () => {
    // Even with max negative jitter on attempt 0
    const interval = getBackoffInterval(0, () => 0);
    expect(interval).toBeGreaterThanOrEqual(1000);
  });
});

describe("useOrderStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
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

  it("returns order data when order exists in store", () => {
    useOrderStore.getState().addOrder(MOCK_ORDER);

    const { result } = renderHook(() => useOrderStatus("ord_test_123"));

    expect(result.current.order).not.toBeNull();
    expect(result.current.order?.orderId).toBe("ord_test_123");
    expect(result.current.order?.status).toBe("paid");
  });

  it("starts polling for non-terminal status", () => {
    useOrderStore.getState().addOrder(MOCK_ORDER);

    const { result } = renderHook(() => useOrderStatus("ord_test_123"));

    expect(result.current.isPolling).toBe(true);
  });

  it("does not poll for terminal status (delivered)", () => {
    useOrderStore.getState().addOrder({ ...MOCK_ORDER, status: "delivered" });

    const { result } = renderHook(() => useOrderStatus("ord_test_123"));

    expect(result.current.isPolling).toBe(false);
  });

  it("does not poll for terminal status (delivery_failed)", () => {
    useOrderStore.getState().addOrder({
      ...MOCK_ORDER,
      status: "delivery_failed",
    });

    const { result } = renderHook(() => useOrderStatus("ord_test_123"));

    expect(result.current.isPolling).toBe(false);
  });

  it("stops polling when status transitions to delivered", () => {
    useOrderStore.getState().addOrder(MOCK_ORDER);

    const { result } = renderHook(() => useOrderStatus("ord_test_123"));
    expect(result.current.isPolling).toBe(true);

    act(() => {
      useOrderStore.getState().updateOrderStatus("ord_test_123", "delivered");
    });

    expect(result.current.isPolling).toBe(false);
  });

  it("stops polling when status transitions to delivery_failed", () => {
    useOrderStore.getState().addOrder(MOCK_ORDER);

    const { result } = renderHook(() => useOrderStatus("ord_test_123"));
    expect(result.current.isPolling).toBe(true);

    act(() => {
      useOrderStore.getState().updateOrderStatus("ord_test_123", "delivery_failed");
    });

    expect(result.current.isPolling).toBe(false);
  });

  it("uses exponential backoff for polling intervals", () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    useOrderStore.getState().addOrder(MOCK_ORDER);

    renderHook(() => useOrderStatus("ord_test_123"));

    // Collect the delay arguments passed to setTimeout by our hook.
    // Filter out non-numeric or very small delays (React internals).
    const delays = setTimeoutSpy.mock.calls
      .map((call) => call[1])
      .filter((d): d is number => typeof d === "number" && d >= 800);

    // First scheduled poll should be around 1000ms (with jitter)
    expect(delays.length).toBeGreaterThanOrEqual(1);
    expect(delays[0]).toBeGreaterThanOrEqual(800);
    expect(delays[0]).toBeLessThanOrEqual(1200);

    // Advance past first poll to trigger second schedule
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    const delaysAfter = setTimeoutSpy.mock.calls
      .map((call) => call[1])
      .filter((d): d is number => typeof d === "number" && d >= 800);

    // Second delay should be larger than first (exponential backoff)
    if (delaysAfter.length >= 2) {
      expect(delaysAfter[1]).toBeGreaterThanOrEqual(delaysAfter[0]);
    }

    setTimeoutSpy.mockRestore();
  });

  it("cleans up polling on unmount by clearing the timer", () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    useOrderStore.getState().addOrder(MOCK_ORDER);

    const { result, unmount } = renderHook(() => useOrderStatus("ord_test_123"));
    expect(result.current.isPolling).toBe(true);

    const callsBefore = clearTimeoutSpy.mock.calls.length;
    unmount();

    // clearTimeout should have been called at least once more after unmount
    expect(clearTimeoutSpy.mock.calls.length).toBeGreaterThan(callsBefore);

    // Advancing timers after unmount should not cause errors
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    clearTimeoutSpy.mockRestore();
  });

  it("stops polling and sets error after max attempts (20)", () => {
    useOrderStore.getState().addOrder(MOCK_ORDER);

    const { result } = renderHook(() => useOrderStatus("ord_test_123"));
    expect(result.current.isPolling).toBe(true);

    // Advance enough time to exhaust all 20 attempts.
    // Max interval is 30s, so 20 * 31s = 620s is more than enough.
    act(() => {
      vi.advanceTimersByTime(700_000);
    });

    expect(result.current.isPolling).toBe(false);
    expect(result.current.error).toBe("Polling timed out. Order status may be stale.");
  });
});
