import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useProtocolEvents, MAX_EVENTS } from "./use-protocol-events";

// ---------------------------------------------------------------------------
// Mock IVXP client
// ---------------------------------------------------------------------------

type EventHandler = (payload: unknown) => void;

function createMockClient() {
  const listeners = new Map<string, Set<EventHandler>>();

  return {
    on(event: string, handler: EventHandler) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(handler);
    },
    off(event: string, handler: EventHandler) {
      listeners.get(event)?.delete(handler);
    },
    emit(event: string, payload: unknown) {
      listeners.get(event)?.forEach((h) => h(payload));
    },
    getListenerCount(event: string) {
      return listeners.get(event)?.size ?? 0;
    },
  };
}

let mockClient: ReturnType<typeof createMockClient> | null = null;

vi.mock("./use-ivxp-client", () => ({
  useIVXPClient: () => mockClient,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useProtocolEvents", () => {
  beforeEach(() => {
    mockClient = createMockClient();
  });

  it("returns empty events and transitions initially", () => {
    const { result } = renderHook(() => useProtocolEvents("ord_1"));

    expect(result.current.events).toEqual([]);
    expect(result.current.transitions).toEqual([]);
  });

  it("appends events when SDK emits them", () => {
    const { result } = renderHook(() => useProtocolEvents("ord_1"));

    act(() => {
      mockClient!.emit("order.quoted", { orderId: "ord_1", price: "5.00" });
    });

    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].type).toBe("order.quoted");
    expect(result.current.events[0].payload).toEqual({
      orderId: "ord_1",
      price: "5.00",
    });
    expect(result.current.events[0].receivedAt).toBeInstanceOf(Date);
    expect(result.current.events[0].id).toBeTruthy();
  });

  it("tracks state transitions from order.status_changed events", () => {
    const { result } = renderHook(() => useProtocolEvents("ord_1"));

    act(() => {
      mockClient!.emit("order.status_changed", {
        previousStatus: null,
        newStatus: "quoted",
      });
    });

    expect(result.current.transitions).toHaveLength(1);
    expect(result.current.transitions[0].from).toBeNull();
    expect(result.current.transitions[0].to).toBe("quoted");
    expect(result.current.transitions[0].timestamp).toBeInstanceOf(Date);
  });

  it("handles multiple events in received order", () => {
    const { result } = renderHook(() => useProtocolEvents("ord_1"));

    act(() => {
      mockClient!.emit("payment.confirmed", { txHash: "0xabc" });
      mockClient!.emit("payment.sent", { txHash: "0xabc" });
    });

    expect(result.current.events).toHaveLength(2);
    expect(result.current.events[0].type).toBe("payment.confirmed");
    expect(result.current.events[1].type).toBe("payment.sent");
  });

  it("handles out-of-order events without errors", () => {
    const { result } = renderHook(() => useProtocolEvents("ord_1"));

    act(() => {
      mockClient!.emit("order.delivered", { orderId: "ord_1" });
      mockClient!.emit("order.quoted", { orderId: "ord_1" });
      mockClient!.emit("payment.sent", { txHash: "0x123" });
    });

    expect(result.current.events).toHaveLength(3);
    expect(result.current.events[0].type).toBe("order.delivered");
    expect(result.current.events[1].type).toBe("order.quoted");
    expect(result.current.events[2].type).toBe("payment.sent");
  });

  it("cleans up listeners on unmount", () => {
    const { unmount } = renderHook(() => useProtocolEvents("ord_1"));

    expect(mockClient!.getListenerCount("order.quoted")).toBe(1);

    unmount();

    expect(mockClient!.getListenerCount("order.quoted")).toBe(0);
    expect(mockClient!.getListenerCount("payment.sent")).toBe(0);
  });

  it("returns empty state when client is null", () => {
    mockClient = null;
    const { result } = renderHook(() => useProtocolEvents("ord_1"));

    expect(result.current.events).toEqual([]);
    expect(result.current.transitions).toEqual([]);
  });

  it("provides clearEvents to reset event list", () => {
    const { result } = renderHook(() => useProtocolEvents("ord_1"));

    act(() => {
      mockClient!.emit("order.quoted", { orderId: "ord_1" });
    });
    expect(result.current.events).toHaveLength(1);

    act(() => {
      result.current.clearEvents();
    });
    expect(result.current.events).toEqual([]);
  });

  it("caps events at MAX_EVENTS and prunes oldest", () => {
    const { result } = renderHook(() => useProtocolEvents("ord_1"));

    act(() => {
      for (let i = 0; i < MAX_EVENTS + 10; i++) {
        mockClient!.emit("order.quoted", { seq: i });
      }
    });

    expect(result.current.events).toHaveLength(MAX_EVENTS);
    // Oldest events should have been pruned; last event should be seq 109
    const lastPayload = result.current.events[MAX_EVENTS - 1].payload as Record<string, number>;
    expect(lastPayload.seq).toBe(MAX_EVENTS + 9);
  });

  it("resets events when orderId changes", () => {
    let orderId = "ord_1";
    const { result, rerender } = renderHook(() => useProtocolEvents(orderId));

    act(() => {
      mockClient!.emit("order.quoted", { orderId: "ord_1" });
    });
    expect(result.current.events).toHaveLength(1);

    orderId = "ord_2";
    rerender();

    expect(result.current.events).toHaveLength(0);
  });

  it("ignores malformed status_changed payloads gracefully", () => {
    const { result } = renderHook(() => useProtocolEvents("ord_1"));

    act(() => {
      mockClient!.emit("order.status_changed", "not-an-object");
      mockClient!.emit("order.status_changed", { noNewStatus: true });
      mockClient!.emit("order.status_changed", null);
    });

    // Events are still recorded, but no transitions created
    expect(result.current.events).toHaveLength(3);
    expect(result.current.transitions).toHaveLength(0);
  });
});
