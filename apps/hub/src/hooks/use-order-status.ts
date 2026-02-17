import { useState, useEffect, useRef } from "react";
import {
  useOrderStore,
  TERMINAL_STATUSES,
  type Order,
} from "@/stores/order-store";

/** Polling configuration constants. */
const INITIAL_INTERVAL_MS = 1_000;
const MAX_INTERVAL_MS = 30_000;
const JITTER_FACTOR = 0.2;
const MAX_POLL_ATTEMPTS = 20;

export interface UseOrderStatusReturn {
  readonly order: Order | null;
  readonly isPolling: boolean;
  readonly error: string | null;
}

/**
 * Calculates the next backoff interval with jitter.
 * Formula: min(base * 2^attempt, max) +/- jitter
 *
 * Accepts an optional `random` function for deterministic testing.
 */
export function getBackoffInterval(
  attempt: number,
  random: () => number = Math.random,
): number {
  const base = Math.min(
    INITIAL_INTERVAL_MS * Math.pow(2, attempt),
    MAX_INTERVAL_MS,
  );
  const jitter = base * JITTER_FACTOR * (random() * 2 - 1);
  return Math.max(INITIAL_INTERVAL_MS, Math.round(base + jitter));
}

function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.includes(status as Order["status"]);
}

/**
 * Hook that tracks an order's status with exponential backoff polling.
 *
 * Reads the order from the Zustand store and polls while the order
 * is in a non-terminal state. Polling stops automatically when the
 * order reaches "delivered", "delivery_failed", or after MAX_POLL_ATTEMPTS.
 */
export function useOrderStatus(orderId: string): UseOrderStatusReturn {
  // Issue #4: inline selector instead of useCallback to avoid
  // unnecessary Zustand re-subscriptions
  const order = useOrderStore(
    (state) => state.orders.find((o) => o.orderId === orderId) ?? null,
  );

  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attemptRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Issue #2: track previous status to avoid resetting backoff
  const prevStatusRef = useRef<string | null>(null);

  useEffect(() => {
    const currentStatus = order?.status ?? null;

    if (!order || isTerminalStatus(order.status)) {
      setIsPolling(false);
      prevStatusRef.current = currentStatus;
      return;
    }

    // Only reset attempt counter when status actually changes,
    // not on every re-render with the same status
    if (currentStatus !== prevStatusRef.current) {
      attemptRef.current = 0;
      setError(null);
    }
    prevStatusRef.current = currentStatus;

    setIsPolling(true);

    function schedulePoll() {
      // Issue #1: stop after max attempts to prevent indefinite polling
      if (attemptRef.current >= MAX_POLL_ATTEMPTS) {
        setIsPolling(false);
        setError("Polling timed out. Order status may be stale.");
        return;
      }

      const interval = getBackoffInterval(attemptRef.current);
      timerRef.current = setTimeout(() => {
        attemptRef.current += 1;

        // Re-read current status from store
        // Issue #3: orderId is captured from the closure that is
        // re-created on each effect run (orderId is in deps),
        // so stale closure is not possible here.
        const currentOrder = useOrderStore
          .getState()
          .getOrder(orderId);

        if (!currentOrder || isTerminalStatus(currentOrder.status)) {
          setIsPolling(false);
          return;
        }

        schedulePoll();
      }, interval);
    }

    schedulePoll();

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [order?.status, orderId]);

  return { order, isPolling, error };
}
