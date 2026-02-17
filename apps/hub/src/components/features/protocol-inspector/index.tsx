"use client";

import { useState, useEffect, useRef } from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ExternalLink,
  Terminal,
  ShieldCheck,
} from "lucide-react";
import { useChainId } from "wagmi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProtocolEvents } from "@/hooks/use-protocol-events";
import { useUiStore } from "@/stores/ui-store";
import { copyToClipboard, getBlockExplorerTxUrl, toWireFormat } from "@/lib/utils";
import type { Order } from "@/stores/order-store";
import {
  ProtocolTooltip,
  type ProtocolField,
} from "@/components/features/protocol-visibility/protocol-tooltip";
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
  tooltipField,
  verified,
}: {
  readonly label: string;
  readonly value: string | undefined;
  readonly explorerUrl?: string;
  readonly tooltipField?: ProtocolField;
  readonly verified?: boolean;
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
      <span className="w-28 shrink-0 text-xs text-zinc-400 flex items-center gap-1">
        {label}
        {tooltipField && <ProtocolTooltip field={tooltipField} />}
      </span>
      <code className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-200">{value}</code>
      {verified !== undefined && (
        <Badge
          data-testid={`verified-${label}`}
          className={
            verified
              ? "gap-1 bg-green-900 text-green-200 text-[10px] px-1.5 py-0"
              : "gap-1 bg-red-900 text-red-200 text-[10px] px-1.5 py-0"
          }
        >
          <ShieldCheck className="h-2.5 w-2.5" aria-hidden="true" />
          {verified ? "Verified" : "Unverified"}
        </Badge>
      )}
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
            <CopyField label="order_id" value={order.orderId} tooltipField="order_id" />
            <CopyField
              label="tx_hash"
              value={order.txHash}
              explorerUrl={explorerUrl}
              tooltipField="tx_hash"
            />
            <CopyField
              label="signed_message"
              value={order.signedMessage}
              tooltipField="signed_message"
            />
            <CopyField
              label="signature"
              value={order.signature}
              tooltipField="signature"
              verified={order.signatureVerified}
            />
            <CopyField label="content_hash" value={order.contentHash} tooltipField="content_hash" />
            <CopyField label="status" value={order.status} tooltipField="status" />
            <CopyField label="provider" value={order.providerAddress} tooltipField="provider" />
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
