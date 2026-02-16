"use client";

import { useState, useEffect, useRef } from "react";
import { Copy, Check } from "lucide-react";
import type { Address } from "viem";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { truncateAddress } from "@/lib/address";
import { formatPrice } from "@/lib/api/services";
import { copyToClipboard } from "@/lib/utils";

interface QuoteDetailsProps {
  readonly orderId: string;
  readonly serviceType: string;
  readonly priceUsdc: string;
  readonly providerAddress: Address;
}

export function QuoteDetails({
  orderId,
  serviceType,
  priceUsdc,
  providerAddress,
}: QuoteDetailsProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopyAddress = async () => {
    const success = await copyToClipboard(providerAddress);
    if (success) {
      setCopied(true);
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-3">
      <DetailRow label="Order ID">
        <span className="font-mono text-sm">{orderId}</span>
      </DetailRow>
      <Separator />
      <DetailRow label="Service">
        <span className="text-sm">{serviceType}</span>
      </DetailRow>
      <Separator />
      <DetailRow label="Price">
        <span className="text-lg font-semibold">{formatPrice(priceUsdc)}</span>
      </DetailRow>
      <Separator />
      <DetailRow label="Provider">
        <span className="flex items-center gap-1">
          <span className="font-mono text-sm">{truncateAddress(providerAddress)}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleCopyAddress}
            data-testid="copy-provider-address"
            aria-label="Copy provider address"
          >
            {copied ? (
              <Check className="h-3 w-3" aria-hidden="true" />
            ) : (
              <Copy className="h-3 w-3" aria-hidden="true" />
            )}
          </Button>
        </span>
      </DetailRow>
    </div>
  );
}

function DetailRow({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
