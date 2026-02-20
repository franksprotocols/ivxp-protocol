"use client";

import { ExternalLink, AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressStepper } from "./progress-stepper";
import { getExplorerTxUrl } from "@/lib/usdc-contract";
import { formatServiceName, formatPrice } from "@/lib/api/services";
import type { Order, OrderStatus } from "@/stores/order-store";
import { CopyButton } from "@/components/features/protocol-visibility/copy-button";
import { ProtocolTooltip } from "@/components/features/protocol-visibility/protocol-tooltip";

interface OrderDetailProps {
  readonly order: Order;
  readonly isPolling: boolean;
}

const STATUS_VARIANT: Record<OrderStatus, "default" | "secondary" | "destructive" | "outline"> = {
  quoted: "outline",
  paying: "secondary",
  paid: "secondary",
  processing: "default",
  delivered: "default",
  failed: "destructive",
  delivery_failed: "destructive",
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  quoted: "Quoted",
  paying: "Paying",
  paid: "Paid",
  processing: "Processing",
  delivered: "Delivered",
  failed: "Failed",
  delivery_failed: "Delivery Failed",
};

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function isDeliveryFailed(status: OrderStatus): boolean {
  return status === "delivery_failed" || status === "failed";
}

export function OrderDetail({ order, isPolling }: OrderDetailProps) {
  const explorerUrl = order.txHash ? getExplorerTxUrl(order.txHash) : null;

  return (
    <div className="space-y-6" data-testid="order-detail">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">Order Details</CardTitle>
            <div className="flex items-center gap-2">
              {isPolling && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
                  Auto-refreshing
                </span>
              )}
              <Badge variant={STATUS_VARIANT[order.status]} data-testid="status-badge">
                {STATUS_LABEL[order.status]}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <ProgressStepper status={order.status} />

          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                Order ID
                <ProtocolTooltip field="order_id" />
              </dt>
              <dd className="mt-1 flex items-center gap-1">
                <span className="font-mono text-sm">{order.orderId}</span>
                <CopyButton value={order.orderId} label="order ID" />
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Service</dt>
              <dd className="mt-1 text-sm">{formatServiceName(order.serviceType)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Price</dt>
              <dd className="mt-1 text-sm">{formatPrice(order.priceUsdc)}</dd>
            </div>
            {explorerUrl && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  Transaction
                  <ProtocolTooltip field="tx_hash" />
                </dt>
                <dd className="mt-1 flex items-center gap-1">
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-sm text-blue-600 hover:underline"
                    aria-label="View transaction on block explorer"
                  >
                    {`${order.txHash?.slice(0, 10)}...${order.txHash?.slice(-6)}`}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  {order.txHash && <CopyButton value={order.txHash} label="transaction hash" />}
                </dd>
              </div>
            )}
            {order.signature && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  Signature
                  <ProtocolTooltip field="signature" />
                </dt>
                <dd className="mt-1 flex items-center gap-1">
                  {order.signatureVerified ? (
                    <Badge className="gap-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                      Verified
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1">
                      <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                      Unverified
                    </Badge>
                  )}
                  <code className="font-mono text-xs truncate max-w-[120px]">
                    {order.signature}
                  </code>
                  <CopyButton value={order.signature} label="signature" />
                </dd>
              </div>
            )}
            {order.contentHash && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  Content Hash
                  <ProtocolTooltip field="content_hash" />
                </dt>
                <dd className="mt-1 flex items-center gap-1">
                  <code className="font-mono text-xs truncate max-w-[160px]">
                    {order.contentHash}
                  </code>
                  <CopyButton value={order.contentHash} label="content hash" />
                </dd>
              </div>
            )}
            <div>
              <dt className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                Status
                <ProtocolTooltip field="status" />
              </dt>
              <dd className="mt-1">
                <Badge variant={STATUS_VARIANT[order.status]} data-testid="status-badge-detail">
                  {STATUS_LABEL[order.status]}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Created</dt>
              <dd className="mt-1 text-sm">{formatTimestamp(order.createdAt)}</dd>
            </div>
            {order.updatedAt && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Updated</dt>
                <dd className="mt-1 text-sm">{formatTimestamp(order.updatedAt)}</dd>
              </div>
            )}
          </dl>

          {(order.requestInput || order.outputPreview) && (
            <div className="space-y-3 rounded-md border p-3">
              {order.requestInput && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Request Input</p>
                  <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 text-xs">
                    {JSON.stringify(order.requestInput, null, 2)}
                  </pre>
                </div>
              )}
              {order.outputPreview && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Output Preview</p>
                  <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 text-xs">
                    {order.outputPreview}
                  </pre>
                </div>
              )}
            </div>
          )}

          {order.status === "delivered" && (
            <p className="text-sm text-muted-foreground">
              Deliverable is available below and will auto-load when ready.
            </p>
          )}

          {isDeliveryFailed(order.status) && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600" aria-hidden="true" />
                <div>
                  <p className="font-medium text-red-800 dark:text-red-200">Delivery Failed</p>
                  <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                    {order.errorMessage ??
                      "An error occurred during delivery. Please contact support."}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
