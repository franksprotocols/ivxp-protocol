"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ShoppingBag, Wallet, AlertTriangle, RefreshCw } from "lucide-react";
import { useAccount } from "wagmi";
import { useOrderStore } from "@/stores/order-store";
import { OrderCard } from "@/components/features/order-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Address } from "viem";

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }, (_, i) => (
        <div
          key={i}
          className="h-20 animate-pulse rounded-xl border bg-muted"
          data-testid="order-skeleton"
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="mx-auto max-w-md text-center">
      <CardContent className="flex flex-col items-center gap-4 py-12">
        <ShoppingBag
          className="h-16 w-16 text-muted-foreground/50"
          aria-hidden="true"
        />
        <div>
          <p className="text-lg font-semibold">No orders yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Place your first order from the marketplace.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/marketplace">Browse the Marketplace</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function DisconnectedState() {
  return (
    <Card className="mx-auto max-w-md text-center">
      <CardContent className="flex flex-col items-center gap-4 py-12">
        <Wallet
          className="h-16 w-16 text-muted-foreground/50"
          aria-hidden="true"
        />
        <p className="text-lg font-semibold">
          Connect wallet to view orders
        </p>
      </CardContent>
    </Card>
  );
}

interface ErrorStateProps {
  readonly message: string;
  readonly onRetry: () => void;
}

function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <Card className="mx-auto max-w-md border-destructive/50">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <AlertTriangle
          className="h-16 w-16 text-destructive/50"
          aria-hidden="true"
        />
        <div>
          <p className="text-lg font-semibold">Failed to load orders</p>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        </div>
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

export function OrderList() {
  const { isConnected, address } = useAccount();
  const isLoading = useOrderStore((s) => s.isLoading);
  const error = useOrderStore((s) => s.error);
  const fetchOrders = useOrderStore((s) => s.fetchOrders);
  const getOrdersByWallet = useOrderStore((s) => s.getOrdersByWallet);

  // Keep order list in sync with wallet connection changes.
  useEffect(() => {
    if (isConnected && address) {
      fetchOrders(address as Address);
    }
  }, [isConnected, address, fetchOrders]);

  if (!isConnected) {
    return <DisconnectedState />;
  }

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={() => {
          if (address) {
            fetchOrders(address as Address);
          }
        }}
      />
    );
  }

  const sortedOrders = address
    ? getOrdersByWallet(address as Address)
    : [];

  if (sortedOrders.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-3">
      {sortedOrders.map((order) => (
        <OrderCard key={order.orderId} order={order} />
      ))}
    </div>
  );
}
