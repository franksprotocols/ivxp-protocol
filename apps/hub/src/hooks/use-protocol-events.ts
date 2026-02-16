import { useState, useEffect, useCallback } from "react";
import { useIVXPClient } from "./use-ivxp-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProtocolEvent {
  readonly id: string;
  readonly type: string;
  readonly payload: unknown;
  readonly receivedAt: Date;
}

export interface StateTransition {
  readonly from: string | null;
  readonly to: string;
  readonly timestamp: Date;
}

export interface UseProtocolEventsReturn {
  readonly events: readonly ProtocolEvent[];
  readonly transitions: readonly StateTransition[];
  readonly clearEvents: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EVENT_TYPES = [
  "order.quoted",
  "order.paid",
  "order.delivered",
  "order.status_changed",
  "payment.sent",
  "payment.confirmed",
  "error",
] as const;

/** Maximum number of events/transitions retained. Oldest are pruned first. */
export const MAX_EVENTS = 100;
const MAX_TRANSITIONS = 50;

/** Generate a unique event ID without module-level mutable state. (#1) */
function nextEventId(type: string): string {
  return `${type}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/** Append to an array while enforcing a max length cap. (#3) */
function appendCapped<T>(prev: readonly T[], item: T, max: number): readonly T[] {
  const next = [...prev, item];
  return next.length > max ? next.slice(next.length - max) : next;
}

/** Safely extract status_changed payload with runtime validation. (#4) */
function parseStatusChangedPayload(
  payload: unknown,
): { previousStatus: string | null; newStatus: string } | null {
  if (typeof payload !== "object" || payload === null) return null;
  const rec = payload as Record<string, unknown>;
  if (typeof rec.newStatus !== "string") return null;
  const previousStatus = typeof rec.previousStatus === "string" ? rec.previousStatus : null;
  return { previousStatus, newStatus: rec.newStatus };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useProtocolEvents(orderId: string): UseProtocolEventsReturn {
  const client = useIVXPClient();
  const [events, setEvents] = useState<readonly ProtocolEvent[]>([]);
  const [transitions, setTransitions] = useState<readonly StateTransition[]>([]);

  useEffect(() => {
    if (!client) return;

    // Reset state when orderId changes so stale events don't leak. (#2)
    setEvents([]);
    setTransitions([]);

    const handlers = EVENT_TYPES.map((eventType) => {
      const handler = (payload: unknown) => {
        const event: ProtocolEvent = {
          id: nextEventId(eventType),
          type: eventType,
          payload,
          receivedAt: new Date(),
        };

        setEvents((prev) => appendCapped(prev, event, MAX_EVENTS));

        if (eventType === "order.status_changed") {
          const parsed = parseStatusChangedPayload(payload);
          if (parsed) {
            const transition: StateTransition = {
              from: parsed.previousStatus,
              to: parsed.newStatus,
              timestamp: new Date(),
            };
            setTransitions((prev) => appendCapped(prev, transition, MAX_TRANSITIONS));
          }
        }
      };

      client.on(eventType, handler);
      return { eventType, handler };
    });

    return () => {
      handlers.forEach(({ eventType, handler }) => {
        client.off(eventType, handler);
      });
    };
    // Note: Events are not filtered by orderId. The SDK client emits all events
    // for the current session, and the inspector intentionally shows them all.
    // Filtering by orderId would require SDK-level support. This is acceptable
    // for a developer debugging tool.
  }, [client, orderId]);

  const clearEvents = useCallback(() => {
    setEvents([]);
    setTransitions([]);
  }, []);

  return { events, transitions, clearEvents };
}
