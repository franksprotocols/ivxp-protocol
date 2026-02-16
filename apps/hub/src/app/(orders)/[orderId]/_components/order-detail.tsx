"use client";

import { ExternalLink, Download, AlertTriangle, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressStepper } from "./progress-stepper";
import { getExplorerTxUrl } from "@/lib/usdc-contract";
import { formatServiceName, formatPrice } from "@/lib/api/services";
import type { Order, OrderStatus } from "@/stores/order-store";

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
              <dt className="text-sm font-medium text-muted-foreground">Order ID</dt>
              <dd className="mt-1 font-mono text-sm">{order.orderId}</dd>
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
                <dt className="text-sm font-medium text-muted-foreground">Transaction</dt>
                <dd className="mt-1">
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
                </dd>
              </div>
            )}
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

          {order.status === "delivered" && (
            <div className="pt-2">
              <Button
                className="gap-2"
                disabled
                title="Download will be available in a future release"
              >
                <Download className="h-4 w-4" />
                Download Deliverable
              </Button>
            </div>
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
