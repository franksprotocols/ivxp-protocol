"use client";

import { use } from "react";
import { PackageSearch, AlertTriangle } from "lucide-react";
import { useOrderStatus } from "@/hooks/use-order-status";
import { OrderDetail } from "./_components/order-detail";
import { ProtocolInspector } from "@/components/features/protocol-inspector";
import { DeliverableViewer } from "@/components/features/deliverable-viewer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface OrderPageProps {
  readonly params: Promise<{ orderId: string }>;
}

function OrderNotFound() {
  return (
    <Card className="mx-auto max-w-md text-center">
      <CardContent className="flex flex-col items-center gap-4 py-12">
        <PackageSearch className="h-16 w-16 text-muted-foreground/50" aria-hidden="true" />
        <div>
          <h2 className="text-lg font-semibold">Order Not Found</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The order you are looking for does not exist or has been removed.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/marketplace">Browse Marketplace</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function OrderStatusContent({ orderId }: { readonly orderId: string }) {
  const { order, isPolling, error } = useOrderStatus(orderId);

  if (!order) {
    return <OrderNotFound />;
  }

  return (
    <>
      {error && (
        <Card className="mb-6 border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-600" aria-hidden="true" />
            <p className="text-sm text-yellow-800 dark:text-yellow-200">{error}</p>
          </CardContent>
        </Card>
      )}
      <OrderDetail order={order} isPolling={isPolling} />
      <DeliverableViewer orderId={order.orderId} orderStatus={order.status} />
      <ProtocolInspector order={order} />
    </>
  );
}

export default function OrderPage({ params }: OrderPageProps) {
  const { orderId } = use(params);

  return (
    <main className="container mx-auto px-4 py-8">
      <OrderStatusContent orderId={orderId} />
    </main>
  );
}
