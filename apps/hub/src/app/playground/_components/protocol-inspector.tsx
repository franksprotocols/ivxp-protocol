"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ProtocolEvent, StateTransition } from "@/hooks/use-protocol-events";
import type { ExecutionResult } from "./service-tester";

interface ProtocolInspectorProps {
  readonly events: readonly ProtocolEvent[];
  readonly transitions: readonly StateTransition[];
  readonly result: ExecutionResult | null;
  readonly onClear: () => void;
}

const PHASE_COLORS: Record<string, string> = {
  "order.quoted": "bg-blue-100 text-blue-800",
  "payment.sent": "bg-yellow-100 text-yellow-800",
  "payment.confirmed": "bg-green-100 text-green-800",
  "order.status_changed": "bg-purple-100 text-purple-800",
  "order.delivered": "bg-emerald-100 text-emerald-800",
  "order.paid": "bg-green-100 text-green-800",
  error: "bg-red-100 text-red-800",
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

export function ProtocolInspector({
  events,
  transitions,
  result,
  onClear,
}: ProtocolInspectorProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <Card data-testid="protocol-inspector">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          Protocol Inspector
          {events.length > 0 && (
            <Badge variant="secondary" data-testid="event-count">
              {events.length}
            </Badge>
          )}
        </CardTitle>
        <div className="flex items-center gap-2">
          {events.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              data-testid="clear-events"
              aria-label="Clear events"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded((prev) => !prev)}
            data-testid="toggle-inspector"
            aria-label={isExpanded ? "Collapse inspector" : "Expand inspector"}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Protocol details */}
          {result && (
            <div data-testid="protocol-details">
              <h4 className="text-sm font-medium mb-2">Protocol Details</h4>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                <dt className="font-medium text-muted-foreground">order_id</dt>
                <dd className="font-mono break-all">{result.orderId}</dd>
                <dt className="font-medium text-muted-foreground">tx_hash</dt>
                <dd className="font-mono break-all">{result.txHash}</dd>
                <dt className="font-medium text-muted-foreground">signature</dt>
                <dd className="font-mono break-all">{result.signature}</dd>
                <dt className="font-medium text-muted-foreground">content_hash</dt>
                <dd className="font-mono break-all">{result.contentHash}</dd>
              </dl>
            </div>
          )}

          {/* State transitions */}
          {transitions.length > 0 && (
            <div data-testid="state-transitions">
              <h4 className="text-sm font-medium mb-2">State Machine Transitions</h4>
              <div className="flex flex-wrap items-center gap-1">
                {transitions.map((t, i) => (
                  <span key={`${t.to}-${i}`} className="flex items-center gap-1">
                    {i === 0 && t.from && (
                      <>
                        <Badge variant="outline" className="text-xs">
                          {t.from}
                        </Badge>
                        <span className="text-muted-foreground">&rarr;</span>
                      </>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {t.to}
                    </Badge>
                    {i < transitions.length - 1 && (
                      <span className="text-muted-foreground">&rarr;</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Event stream */}
          <div data-testid="event-stream" aria-label="SDK event stream">
            <h4 className="text-sm font-medium mb-2" id="event-stream-heading">
              SDK Event Stream
            </h4>
            {events.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No events yet. Execute a service to see protocol internals.
              </p>
            ) : (
              <div
                className="max-h-64 overflow-y-auto space-y-1"
                role="log"
                aria-live="polite"
                aria-label="Protocol events"
                aria-labelledby="event-stream-heading"
                tabIndex={0}
              >
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-2 rounded px-2 py-1 text-xs hover:bg-muted/50"
                    data-testid={`event-${event.type}`}
                  >
                    <span className="shrink-0 font-mono text-muted-foreground">
                      {formatTime(event.receivedAt)}
                    </span>
                    <Badge
                      className={`shrink-0 text-xs ${PHASE_COLORS[event.type] ?? "bg-gray-100 text-gray-800"}`}
                    >
                      {event.type}
                    </Badge>
                    <span className="truncate font-mono text-muted-foreground">
                      {JSON.stringify(event.payload)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
