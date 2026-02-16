"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { formatPrice } from "@/lib/api/services";
import type { ServiceDetail } from "@/lib/types/service";
import { ServiceRequestForm } from "@/components/features/service-request-form";

interface ServiceActionsProps {
  readonly service: ServiceDetail;
}

export function ServiceActions({ service }: ServiceActionsProps) {
  const { isConnected } = useAccount();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const handleRequestClick = () => {
    setIsSheetOpen(true);
  };

  const handleQuoteReceived = () => {
    setIsSheetOpen(false);
    // Quote Dialog (Story 5.2) will be triggered here
  };

  return (
    <div className="space-y-3" data-testid="service-actions">
      <Button
        size="lg"
        className="w-full"
        disabled={!isConnected}
        onClick={handleRequestClick}
        data-testid="request-service-button"
      >
        <Wallet className="mr-2 h-4 w-4" aria-hidden="true" />
        Request Service - {formatPrice(service.price_usdc)}
      </Button>
      {!isConnected && (
        <p
          className="text-center text-sm text-muted-foreground"
          data-testid="wallet-prompt"
        >
          Connect your wallet to request this service
        </p>
      )}

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Request Service</SheetTitle>
            <SheetDescription>
              Fill in the details below to request a quote for this service.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            <ServiceRequestForm
              service={service}
              onQuoteReceived={handleQuoteReceived}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
