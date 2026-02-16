"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { ProtocolEvent } from "@/hooks/use-protocol-events";

// ---------------------------------------------------------------------------
// Event type badge colors
// ---------------------------------------------------------------------------

function getEventBadgeVariant(type: string): "default" | "secondary" | "destructive" | "outline" {
  if (type.startsWith("order.")) return "default";
  if (type.startsWith("payment.")) return "secondary";
  if (type === "error") return "destructive";
  return "outline";
}

// ---------------------------------------------------------------------------
// Single event row
// ---------------------------------------------------------------------------

function EventRow({ event }: { readonly event: ProtocolEvent }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-zinc-800 py-1.5 last:border-b-0">
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-label={`${expanded ? "Collapse" : "Expand"} ${event.type} event`}
      >
        <ChevronRight
          className={cn("h-3 w-3 shrink-0 transition-transform", expanded && "rotate-90")}
        />
        <Badge
          variant={getEventBadgeVariant(event.type)}
          className="shrink-0 font-mono text-[10px]"
        >
          {event.type}
        </Badge>
        <span className="ml-auto shrink-0 text-[10px] text-zinc-500">
          {formatRelativeTime(event.receivedAt)}
        </span>
      </button>
      {expanded && (
        <pre className="mt-1 ml-5 overflow-x-auto rounded bg-zinc-900 p-2 font-mono text-[10px] text-zinc-300">
          {JSON.stringify(event.payload, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EventLog
// ---------------------------------------------------------------------------

/** Threshold (px) for considering the user "at the bottom" of the scroll. */
const SCROLL_THRESHOLD = 40;

interface EventLogProps {
  readonly events: readonly ProtocolEvent[];
}

export function EventLog({ events }: EventLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_THRESHOLD;
  }, []);

  // Auto-scroll only when user is already at the bottom.
  // Track the events array reference (not just length) so replacements
  // or resets also trigger a scroll check.
  useEffect(() => {
    if (scrollRef.current && isAtBottomRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  if (events.length === 0) {
    return <p className="py-2 text-center text-xs text-zinc-500">No events yet</p>;
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="max-h-48 overflow-y-auto rounded border border-zinc-800 bg-zinc-900/50 px-2"
    >
      {events.map((event) => (
        <EventRow key={event.id} event={event} />
      ))}
    </div>
  );
}
