"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Star, User } from "lucide-react";
import type { ServiceDetail } from "@/lib/types/service";
import { truncateAddress } from "@/lib/address";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ProviderInfoProps {
  readonly service: ServiceDetail;
}

export function ProviderInfo({ service }: ProviderInfoProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleCopyAddress = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(service.provider_address);
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available in all contexts
    }
  }, [service.provider_address]);

  const displayAddress = truncateAddress(service.provider_address);
  const displayName = service.provider_name ?? displayAddress;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Provider</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="font-medium" data-testid="provider-name">
            {displayName}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="font-mono text-sm text-muted-foreground"
            title={service.provider_address}
            data-testid="provider-address"
          >
            {displayAddress}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={handleCopyAddress}
            aria-label="Copy provider address"
            data-testid="copy-address-button"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>

        {service.provider_reputation != null && (
          <div className="flex items-center gap-1" data-testid="provider-reputation">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" aria-hidden="true" />
            <span className="text-sm font-medium">{service.provider_reputation.toFixed(1)}</span>
            <span className="text-sm text-muted-foreground">/ 5.0</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
