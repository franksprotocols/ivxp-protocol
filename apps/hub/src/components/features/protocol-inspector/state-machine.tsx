"use client";

import { cn, formatRelativeTime } from "@/lib/utils";
import type { OrderStatus } from "@/stores/order-store";
import type { StateTransition } from "@/hooks/use-protocol-events";

// ---------------------------------------------------------------------------
// State definitions
// ---------------------------------------------------------------------------

const STATES: readonly OrderStatus[] = [
  "quoted",
  "paying",
  "paid",
  "processing",
  "delivered",
] as const;

const STATE_LABELS: Record<string, string> = {
  quoted: "Quoted",
  paying: "Paying",
  paid: "Paid",
  processing: "Processing",
  delivered: "Delivered",
  failed: "Failed",
  delivery_failed: "Delivery Failed",
};

function stateIndex(status: OrderStatus): number {
  const idx = STATES.indexOf(status);
  return idx >= 0 ? idx : -1;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface StateMachineProps {
  readonly currentStatus: OrderStatus;
  readonly transitions: readonly StateTransition[];
}

export function StateMachine({ currentStatus, transitions }: StateMachineProps) {
  const currentIdx = stateIndex(currentStatus);
  const isFailed = currentStatus === "failed" || currentStatus === "delivery_failed";

  // Build a map of state -> transition timestamp
  const transitionTimestamps = new Map<string, Date>();
  for (const t of transitions) {
    transitionTimestamps.set(t.to, t.timestamp);
  }

  return (
    <div className="flex items-center gap-1">
      {STATES.map((state, idx) => {
        const isActive = state === currentStatus;
        const isPast = currentIdx >= 0 && idx < currentIdx;
        const ts = transitionTimestamps.get(state);

        return (
          <div key={state} className="flex items-center gap-1">
            {idx > 0 && (
              <div
                className={cn("h-px w-4", isPast || isActive ? "bg-green-500" : "bg-zinc-700")}
              />
            )}
            <div
              data-testid={`state-${state}`}
              data-active={isActive ? "true" : "false"}
              className="flex flex-col items-center"
            >
              <div
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold",
                  isActive && !isFailed && "bg-green-500 text-white",
                  isPast && "bg-green-800 text-green-200",
                  !isActive && !isPast && "bg-zinc-800 text-zinc-500",
                )}
              >
                {idx + 1}
              </div>
              <span className="mt-0.5 text-[9px] text-zinc-400">{STATE_LABELS[state]}</span>
              {ts && <span className="text-[8px] text-zinc-600">{formatRelativeTime(ts)}</span>}
            </div>
          </div>
        );
      })}

      {isFailed && (
        <div className="flex items-center gap-1">
          <div className="h-px w-4 bg-red-700" />
          <div
            data-testid={`state-${currentStatus}`}
            data-active="true"
            className="flex flex-col items-center"
          >
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[8px] font-bold text-white">
              !
            </div>
            <span className="mt-0.5 text-[9px] text-red-400">{STATE_LABELS[currentStatus]}</span>
          </div>
        </div>
      )}
    </div>
  );
}
