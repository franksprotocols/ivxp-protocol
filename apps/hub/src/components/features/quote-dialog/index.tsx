"use client";

import { useState, useEffect } from "react";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useOrderStore } from "@/stores/order-store";
import { QuoteDetails } from "./quote-details";
import { ExpiryCountdown, useQuoteExpiry } from "./expiry-countdown";

export interface Quote {
  readonly orderId: string;
  readonly serviceType: string;
  readonly priceUsdc: string;
  readonly requestInput?: Record<string, unknown>;
  readonly providerAddress: Address;
  readonly providerId?: string;
  readonly providerEndpointUrl?: string;
  readonly expiresAt: Date;
}

interface QuoteDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly quote: Quote;
  readonly onConfirm: (quote: Quote) => void;
  readonly onRequestNewQuote: () => void;
}

/**
 * Displays a quote for user review before proceeding to payment.
 * Handles expiry countdown, confirm (stores order as "quoted"), and cancel.
 */
export function QuoteDialog({
  open,
  onOpenChange,
  quote,
  onConfirm,
  onRequestNewQuote,
}: QuoteDialogProps) {
  const { address } = useAccount();
  const { isExpired, timeRemaining, isWarning, isCritical } = useQuoteExpiry(quote.expiresAt);
  const addOrder = useOrderStore((s) => s.addOrder);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (!open) {
      setIsConfirming(false);
    }
  }, [open]);

  useEffect(() => {
    setIsConfirming(false);
  }, [quote]);

  const handleConfirm = () => {
    if (isConfirming) {
      return;
    }
    if (!address) {
      return;
    }
    setIsConfirming(true);
    addOrder({
      orderId: quote.orderId,
      serviceType: quote.serviceType,
      priceUsdc: quote.priceUsdc,
      requestInput: quote.requestInput,
      providerAddress: quote.providerAddress,
      providerId: quote.providerId,
      providerEndpointUrl: quote.providerEndpointUrl,
      clientAddress: address,
      status: "quoted",
      createdAt: Date.now(),
    });
    onConfirm(quote);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quote Confirmation</DialogTitle>
          <DialogDescription>Review your quote before proceeding to payment.</DialogDescription>
        </DialogHeader>

        <QuoteDetails
          orderId={quote.orderId}
          serviceType={quote.serviceType}
          priceUsdc={quote.priceUsdc}
          providerAddress={quote.providerAddress}
        />

        <ExpiryCountdown
          timeRemaining={timeRemaining}
          isExpired={isExpired}
          isWarning={isWarning}
          isCritical={isCritical}
        />

        {!address ? (
          <p className="text-sm text-amber-700" data-testid="reconnect-prompt">
            Reconnect wallet to continue.
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          {isExpired ? (
            <Button onClick={onRequestNewQuote}>Request New Quote</Button>
          ) : !address ? (
            <Button disabled>Reconnect Wallet</Button>
          ) : (
            <Button onClick={handleConfirm} disabled={isConfirming}>
              Confirm & Pay
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
