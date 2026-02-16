import Link from "next/link";
import { DollarSign, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatServiceName, formatPrice } from "@/lib/api/services";
import type { Order, OrderStatus } from "@/stores/order-store";

interface OrderCardProps {
  readonly order: Order;
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  quoted: "Quoted",
  paying: "Paying",
  paid: "Paid",
  processing: "Processing",
  delivered: "Delivered",
  failed: "Failed",
  delivery_failed: "Delivery Failed",
};

const STATUS_VARIANT: Record<OrderStatus, "default" | "secondary" | "destructive" | "outline"> = {
  quoted: "outline",
  paying: "secondary",
  paid: "secondary",
  processing: "default",
  delivered: "default",
  failed: "destructive",
  delivery_failed: "destructive",
};

function truncateOrderId(orderId: string): string {
  if (orderId.length <= 16) return orderId;
  return `${orderId.slice(0, 8)}...${orderId.slice(-4)}`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function OrderCard({ order }: OrderCardProps) {
  const serviceName = formatServiceName(order.serviceType);

  return (
    <Link
      href={`/orders/${order.orderId}`}
      className="block transition-shadow hover:shadow-md rounded-xl"
      aria-label={`View order ${truncateOrderId(order.orderId)} - ${serviceName}`}
    >
      <Card className="h-full">
        <CardContent className="flex items-center justify-between gap-4 py-4">
          <div className="flex flex-col gap-1 min-w-0">
            <span className="font-mono text-sm truncate">{truncateOrderId(order.orderId)}</span>
            <span className="text-sm text-muted-foreground">{serviceName}</span>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge variant={STATUS_VARIANT[order.status]} data-testid="order-status-badge">
              {STATUS_LABEL[order.status]}
            </Badge>
            <span className="text-sm font-medium flex items-center gap-1">
              <DollarSign className="h-3 w-3" aria-hidden="true" />
              {formatPrice(order.priceUsdc)}
            </span>
            <span
              className="text-xs text-muted-foreground flex items-center gap-1"
              data-testid="order-date"
            >
              <Clock className="h-3 w-3" aria-hidden="true" />
              {formatDate(order.createdAt)}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
