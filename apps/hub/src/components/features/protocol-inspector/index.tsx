"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, Copy, Check, ExternalLink, Terminal } from "lucide-react";
import { useChainId } from "wagmi";
import { Button } from "@/components/ui/button";
import { useProtocolEvents } from "@/hooks/use-protocol-events";
import { useUiStore } from "@/stores/ui-store";
import { copyToClipboard, getBlockExplorerTxUrl, toWireFormat } from "@/lib/utils";
import type { Order } from "@/stores/order-store";
import { EventLog } from "./event-log";
import { StateMachine } from "./state-machine";
import { RawJsonViewer } from "./raw-json-viewer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProtocolInspectorProps {
  readonly order: Order;
}

// ---------------------------------------------------------------------------
// CopyField -- inline field with copy button
// ---------------------------------------------------------------------------

function CopyField({
  label,
  value,
  explorerUrl,
}: {
  readonly label: string;
  readonly value: string | undefined;
  readonly explorerUrl?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timeout on unmount (#6)
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  if (!value) return null;

  async function handleCopy() {
    // value is guaranteed non-null by the early return above
    const ok = await copyToClipboard(value!);
    if (ok) {
      setCopied(true);
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="flex items-center gap-2 py-1">
      <span className="w-28 shrink-0 text-xs text-zinc-400">{label}</span>
      <code className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-200">{value}</code>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={handleCopy}
        aria-label={`Copy ${label}`}
      >
        {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
      </Button>
      {explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0"
          aria-label="View on explorer"
        >
          <ExternalLink className="h-3 w-3 text-blue-400 hover:text-blue-300" />
        </a>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ProtocolInspector({ order }: ProtocolInspectorProps) {
  const chainId = useChainId();
  const isOpen = useUiStore((s) => s.inspectorOpen);
  const toggleInspector = useUiStore((s) => s.toggleInspector);
  // Note: useProtocolEvents runs even when the panel is closed. This is a React
  // hooks constraint (hooks cannot be called conditionally). The tradeoff is
  // acceptable: events are collected in the background so they're available
  // immediately when the user opens the panel.
  const { events, transitions } = useProtocolEvents(order.orderId);

  const explorerUrl = order.txHash ? getBlockExplorerTxUrl(order.txHash, chainId) : undefined;

  const wireData = toWireFormat({
    orderId: order.orderId,
    serviceType: order.serviceType,
    priceUsdc: order.priceUsdc,
    providerAddress: order.providerAddress,
    status: order.status,
    txHash: order.txHash ?? null,
    signedMessage: order.signedMessage ?? null,
    signature: order.signature ?? null,
    contentHash: order.contentHash ?? null,
  });

  return (
    <div className="mt-4">
      <Button
        variant="outline"
        size="sm"
        className="gap-2 border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
        onClick={toggleInspector}
        aria-label={isOpen ? "Close Protocol Inspector" : "Open Protocol Inspector"}
      >
        <Terminal className="h-4 w-4" />
        Protocol Inspector
        {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </Button>

      {isOpen && (
        <div
          data-testid="inspector-panel"
          className="mt-2 rounded-lg border border-zinc-700 bg-zinc-950 p-4 text-zinc-200"
        >
          {/* Protocol Fields */}
          <section className="mb-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Protocol Fields
            </h3>
            <CopyField label="order_id" value={order.orderId} />
            <CopyField label="tx_hash" value={order.txHash} explorerUrl={explorerUrl} />
            <CopyField label="signed_message" value={order.signedMessage} />
            <CopyField label="signature" value={order.signature} />
            <CopyField label="content_hash" value={order.contentHash} />
            <CopyField label="status" value={order.status} />
            <CopyField label="provider" value={order.providerAddress} />
          </section>

          {/* State Machine */}
          <section className="mb-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              State Machine
            </h3>
            <StateMachine currentStatus={order.status} transitions={transitions} />
          </section>

          {/* Event Log */}
          <section className="mb-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Event Log
            </h3>
            <EventLog events={events} />
          </section>

          {/* Raw Wire Format */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Raw Wire Format
            </h3>
            <RawJsonViewer data={wireData} />
          </section>
        </div>
      )}
    </div>
  );
}
