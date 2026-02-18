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
import type { ServiceQuote } from "@/hooks/use-service-request";
import { ServiceRequestForm } from "@/components/features/service-request-form";

interface ServiceActionsProps {
  readonly service: ServiceDetail;
  readonly onQuoteReceived?: (quote: ServiceQuote) => void;
}

export function ServiceActions({ service, onQuoteReceived }: ServiceActionsProps) {
  const { isConnected } = useAccount();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const handleRequestClick = () => {
    setIsSheetOpen(true);
  };

  const handleQuoteReceived = (quote: ServiceQuote) => {
    onQuoteReceived?.(quote);
  };

  return (
    <div className="space-y-3" data-testid="service-actions">
      <Button
        size="lg"
        className="w-full"
        onClick={handleRequestClick}
        data-testid="request-service-button"
      >
        <Wallet className="mr-2 h-4 w-4" aria-hidden="true" />
        Request Service - {formatPrice(service.price_usdc)}
      </Button>
      {!isConnected && (
        <p className="text-center text-sm text-muted-foreground" data-testid="wallet-prompt">
          Connect your wallet to request this service
        </p>
      )}

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="px-6">
            <SheetTitle>Request Service</SheetTitle>
            <SheetDescription>
              Fill in the details below to request a quote for this service.
            </SheetDescription>
          </SheetHeader>
          <div className="px-6 pb-6">
            <ServiceRequestForm service={service} onQuoteReceived={handleQuoteReceived} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
