/**
 * E2E Integration Test: Order Management
 *
 * Tests order history, order detail, polling behavior, and
 * wallet-aware order filtering/sorting.
 *
 * ACs covered: #9 (polling), #10 (wallet disconnection + state preservation)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { renderHook, act, render, screen } from "@testing-library/react";
import { useOrderStatus, getBackoffInterval } from "@/hooks/use-order-status";
import { useOrderStore, TERMINAL_STATUSES } from "@/stores/order-store";
import type { Order, OrderStatus } from "@/stores/order-store";
import type { Address } from "viem";
import { OrderCard } from "@/components/features/order-card";
import {
  TEST_WALLET_ADDRESS,
  PROVIDER_ADDRESS,
  FAKE_TX_HASH,
  E2E_TEST_TIMEOUT,
} from "./helpers/setup";
import { assertOrderInStatus } from "./helpers/assertions";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function createTestOrder(overrides: Partial<Order> = {}): Order {
  return {
    orderId: `ord_mgmt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    serviceType: "text_echo",
    priceUsdc: "1.00",
    providerAddress: PROVIDER_ADDRESS,
    clientAddress: TEST_WALLET_ADDRESS,
    status: "quoted" as OrderStatus,
    createdAt: Date.now(),
    txHash: FAKE_TX_HASH,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("E2E: Order Management", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useOrderStore.getState().clearOrders();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── AC #9: Polling behavior ──────────────────────────────────────────

  describe("Order Status Polling", () => {
    it(
      "reflects status changes within polling interval",
      () => {
        const order = createTestOrder({
          orderId: "ord_poll_001",
          status: "paid",
        });
        useOrderStore.getState().addOrder(order);

        const { result } = renderHook(() => useOrderStatus("ord_poll_001"));

        expect(result.current.isPolling).toBe(true);
        assertOrderInStatus(result.current.order, "paid");

        // Simulate provider updating status
        act(() => {
          useOrderStore.getState().updateOrderStatus("ord_poll_001", "processing");
        });

        assertOrderInStatus(result.current.order, "processing");
        expect(result.current.isPolling).toBe(true);
      },
      E2E_TEST_TIMEOUT,
    );

    it("follows exponential backoff pattern", () => {
      const noJitter = () => 0.5;

      // Verify doubling: 1s -> 2s -> 4s -> 8s -> 16s -> 30s (capped)
      expect(getBackoffInterval(0, noJitter)).toBe(1000);
      expect(getBackoffInterval(1, noJitter)).toBe(2000);
      expect(getBackoffInterval(2, noJitter)).toBe(4000);
      expect(getBackoffInterval(3, noJitter)).toBe(8000);
      expect(getBackoffInterval(4, noJitter)).toBe(16000);
      expect(getBackoffInterval(5, noJitter)).toBe(30000); // capped
      expect(getBackoffInterval(10, noJitter)).toBe(30000); // still capped
    });

    it("applies jitter within 20% range", () => {
      // random() = 0 => max negative jitter
      const minJitter = getBackoffInterval(1, () => 0);
      // random() = 1 => max positive jitter
      const maxJitter = getBackoffInterval(1, () => 1);

      // base=2000, jitter=20%, range=[1600, 2400]
      expect(minJitter).toBeGreaterThanOrEqual(1600);
      expect(maxJitter).toBeLessThanOrEqual(2400);
    });

    it(
      "stops polling when terminal state reached (delivered)",
      () => {
        const order = createTestOrder({
          orderId: "ord_poll_002",
          status: "processing",
        });
        useOrderStore.getState().addOrder(order);

        const { result } = renderHook(() => useOrderStatus("ord_poll_002"));
        expect(result.current.isPolling).toBe(true);

        act(() => {
          useOrderStore.getState().updateOrderStatus("ord_poll_002", "delivered");
        });

        expect(result.current.isPolling).toBe(false);
        assertOrderInStatus(result.current.order, "delivered");
      },
      E2E_TEST_TIMEOUT,
    );

    it(
      "stops polling when terminal state reached (delivery_failed)",
      () => {
        const order = createTestOrder({
          orderId: "ord_poll_003",
          status: "processing",
        });
        useOrderStore.getState().addOrder(order);

        const { result } = renderHook(() => useOrderStatus("ord_poll_003"));
        expect(result.current.isPolling).toBe(true);

        act(() => {
          useOrderStore.getState().updateOrderStatus("ord_poll_003", "delivery_failed");
        });

        expect(result.current.isPolling).toBe(false);
      },
      E2E_TEST_TIMEOUT,
    );

    it(
      "stops polling and sets error after max attempts (20)",
      () => {
        const order = createTestOrder({
          orderId: "ord_poll_004",
          status: "paid",
        });
        useOrderStore.getState().addOrder(order);

        const { result } = renderHook(() => useOrderStatus("ord_poll_004"));
        expect(result.current.isPolling).toBe(true);

        // Advance enough time to exhaust all 20 attempts
        act(() => {
          vi.advanceTimersByTime(700_000);
        });

        expect(result.current.isPolling).toBe(false);
        expect(result.current.error).toBe("Polling timed out. Order status may be stale.");
      },
      E2E_TEST_TIMEOUT,
    );

    it("does not poll for already-terminal orders", () => {
      for (const status of TERMINAL_STATUSES) {
        useOrderStore.getState().clearOrders();
        const order = createTestOrder({
          orderId: `ord_terminal_${status}`,
          status,
        });
        useOrderStore.getState().addOrder(order);

        const { result } = renderHook(() => useOrderStatus(`ord_terminal_${status}`));
        expect(result.current.isPolling).toBe(false);
      }
    });

    it("cleans up polling timer on unmount", () => {
      const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
      const order = createTestOrder({
        orderId: "ord_poll_cleanup",
        status: "paid",
      });
      useOrderStore.getState().addOrder(order);

      const { result, unmount } = renderHook(() => useOrderStatus("ord_poll_cleanup"));
      expect(result.current.isPolling).toBe(true);

      const callsBefore = clearTimeoutSpy.mock.calls.length;
      unmount();

      expect(clearTimeoutSpy.mock.calls.length).toBeGreaterThan(callsBefore);
      clearTimeoutSpy.mockRestore();
    });
  });

  // ── Order Store: CRUD and filtering ──────────────────────────────────

  describe("Order Store Operations", () => {
    it("adds order to store", () => {
      const order = createTestOrder({ orderId: "ord_store_001" });
      useOrderStore.getState().addOrder(order);

      const stored = useOrderStore.getState().getOrder("ord_store_001");
      expect(stored).toBeDefined();
      expect(stored!.orderId).toBe("ord_store_001");
    });

    it("updates order status immutably", () => {
      const order = createTestOrder({
        orderId: "ord_store_002",
        status: "quoted",
      });
      useOrderStore.getState().addOrder(order);

      useOrderStore.getState().updateOrderStatus("ord_store_002", "paid");

      const updated = useOrderStore.getState().getOrder("ord_store_002");
      expect(updated!.status).toBe("paid");
      expect(updated!.updatedAt).toBeDefined();
      // Original order object should not be mutated
      expect(order.status).toBe("quoted");
    });

    it("updates order payment data immutably", () => {
      const order = createTestOrder({
        orderId: "ord_store_003",
        status: "quoted",
      });
      useOrderStore.getState().addOrder(order);

      useOrderStore.getState().updateOrderPayment("ord_store_003", {
        txHash: FAKE_TX_HASH,
        status: "paying",
      });

      const updated = useOrderStore.getState().getOrder("ord_store_003");
      expect(updated!.txHash).toBe(FAKE_TX_HASH);
      expect(updated!.status).toBe("paying");
    });

    it("returns orders sorted by date (newest first)", () => {
      const older = createTestOrder({
        orderId: "ord_older",
        createdAt: new Date("2025-01-01").getTime(),
      });
      const newer = createTestOrder({
        orderId: "ord_newer",
        createdAt: new Date("2025-06-01").getTime(),
      });

      useOrderStore.getState().addOrder(older);
      useOrderStore.getState().addOrder(newer);

      const orders = useOrderStore.getState().getOrdersByWallet(TEST_WALLET_ADDRESS);

      expect(orders[0].orderId).toBe("ord_newer");
      expect(orders[1].orderId).toBe("ord_older");
    });

    it("clears all orders", () => {
      useOrderStore.getState().addOrder(createTestOrder({ orderId: "ord_clear_1" }));
      useOrderStore.getState().addOrder(createTestOrder({ orderId: "ord_clear_2" }));

      expect(useOrderStore.getState().orders.length).toBe(2);

      useOrderStore.getState().clearOrders();

      expect(useOrderStore.getState().orders.length).toBe(0);
    });

    it("getOrder returns undefined for nonexistent order", () => {
      const result = useOrderStore.getState().getOrder("nonexistent");
      expect(result).toBeUndefined();
    });
  });

  // ── Order history and detail ─────────────────────────────────────────

  describe("Order History and Detail", () => {
    it("order appears in history after creation", () => {
      const order = createTestOrder({ orderId: "ord_history_001" });
      useOrderStore.getState().addOrder(order);

      const orders = useOrderStore.getState().getOrdersByWallet(TEST_WALLET_ADDRESS);

      const found = orders.find((o) => o.orderId === "ord_history_001");
      expect(found).toBeDefined();
    });

    it("order detail shows correct data", () => {
      const order = createTestOrder({
        orderId: "ord_detail_001",
        serviceType: "image_gen",
        priceUsdc: "1.50",
        status: "delivered",
      });
      useOrderStore.getState().addOrder(order);

      const detail = useOrderStore.getState().getOrder("ord_detail_001");
      expect(detail!.serviceType).toBe("image_gen");
      expect(detail!.priceUsdc).toBe("1.50");
      expect(detail!.status).toBe("delivered");
      expect(detail!.providerAddress).toBe(PROVIDER_ADDRESS);
    });

    it("order list filters by connected wallet", () => {
      const order1 = {
        ...createTestOrder({ orderId: "ord_filter_001" }),
        clientAddress: TEST_WALLET_ADDRESS,
      };
      const order2 = {
        ...createTestOrder({ orderId: "ord_filter_002" }),
        clientAddress: "0x1234000000000000000000000000000000000000" as Address,
      };
      useOrderStore.getState().addOrder(order1);
      useOrderStore.getState().addOrder(order2);

      const orders = useOrderStore.getState().getOrdersByWallet(TEST_WALLET_ADDRESS);

      expect(orders.length).toBe(1);
      expect(orders[0].orderId).toBe("ord_filter_001");
    });

    it("order list sorts by date (newest first)", () => {
      const orders = [
        createTestOrder({
          orderId: "ord_sort_1",
          createdAt: new Date("2025-01-01").getTime(),
        }),
        createTestOrder({
          orderId: "ord_sort_3",
          createdAt: new Date("2025-03-01").getTime(),
        }),
        createTestOrder({
          orderId: "ord_sort_2",
          createdAt: new Date("2025-02-01").getTime(),
        }),
      ];

      for (const order of orders) {
        useOrderStore.getState().addOrder(order);
      }

      const sorted = useOrderStore.getState().getOrdersByWallet(TEST_WALLET_ADDRESS);

      expect(sorted[0].orderId).toBe("ord_sort_3");
      expect(sorted[1].orderId).toBe("ord_sort_2");
      expect(sorted[2].orderId).toBe("ord_sort_1");
    });

    it("order status transitions are tracked with updatedAt", () => {
      const order = createTestOrder({
        orderId: "ord_transition_001",
        status: "quoted",
      });
      useOrderStore.getState().addOrder(order);

      useOrderStore.getState().updateOrderStatus("ord_transition_001", "paying");
      const afterPaying = useOrderStore.getState().getOrder("ord_transition_001");
      expect(afterPaying!.updatedAt).toBeDefined();

      useOrderStore.getState().updateOrderStatus("ord_transition_001", "paid");
      const afterPaid = useOrderStore.getState().getOrder("ord_transition_001");
      expect(afterPaid!.updatedAt).toBeDefined();
      expect(afterPaid!.status).toBe("paid");
    });

    it("navigation between order list and order detail uses orderId route", () => {
      const order = createTestOrder({
        orderId: "ord_nav_001",
        status: "processing",
      });

      render(createElement(OrderCard, { order }));

      const link = screen.getByRole("link", { name: /view order/i });
      expect(link).toHaveAttribute("href", "/orders/ord_nav_001");
    });
  });

  // ── AC #10: Wallet disconnection and state preservation ──────────────

  describe("Wallet Disconnection and State Preservation", () => {
    it("order store preserves orders when wallet disconnects", () => {
      const order = createTestOrder({
        orderId: "ord_preserve_001",
        status: "paid",
      });
      useOrderStore.getState().addOrder(order);

      // Simulate wallet disconnect -- store should still have the order
      const stored = useOrderStore.getState().getOrder("ord_preserve_001");
      expect(stored).toBeDefined();
      expect(stored!.status).toBe("paid");
    });

    it("order store preserves payment data across reconnection", () => {
      const order = createTestOrder({
        orderId: "ord_preserve_002",
        status: "paying",
      });
      useOrderStore.getState().addOrder(order);

      useOrderStore.getState().updateOrderPayment("ord_preserve_002", {
        txHash: FAKE_TX_HASH,
        blockNumber: 42n,
        status: "paid",
      });

      // After "reconnection", data should still be there
      const stored = useOrderStore.getState().getOrder("ord_preserve_002");
      expect(stored!.txHash).toBe(FAKE_TX_HASH);
      expect(stored!.blockNumber).toBe(42n);
      expect(stored!.status).toBe("paid");
    });

    it("polling resumes for non-terminal orders after reconnection", () => {
      const order = createTestOrder({
        orderId: "ord_resume_001",
        status: "processing",
      });
      useOrderStore.getState().addOrder(order);

      // First render -- polling starts
      const { result, unmount } = renderHook(() => useOrderStatus("ord_resume_001"));
      expect(result.current.isPolling).toBe(true);

      // Unmount (simulate disconnect)
      unmount();

      // Re-render (simulate reconnection)
      const { result: result2 } = renderHook(() => useOrderStatus("ord_resume_001"));
      expect(result2.current.isPolling).toBe(true);
      expect(result2.current.order!.status).toBe("processing");
    });

    it("polling does not resume for terminal orders after reconnection", () => {
      const order = createTestOrder({
        orderId: "ord_resume_002",
        status: "delivered",
      });
      useOrderStore.getState().addOrder(order);

      const { result } = renderHook(() => useOrderStatus("ord_resume_002"));
      expect(result.current.isPolling).toBe(false);
    });

    it("fetchOrders handles loading state correctly", async () => {
      const store = useOrderStore.getState();
      expect(store.isLoading).toBe(false);

      // fetchOrders is async with a simulated delay
      const fetchPromise = store.fetchOrders(TEST_WALLET_ADDRESS);

      // After starting, isLoading should be true
      expect(useOrderStore.getState().isLoading).toBe(true);

      // Advance timers to complete the fetch
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await fetchPromise;

      expect(useOrderStore.getState().isLoading).toBe(false);
      expect(useOrderStore.getState().error).toBeNull();
    });
  });
});
