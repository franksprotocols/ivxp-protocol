"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { truncateAddress } from "@/lib/address";

interface WalletDisplayProps {
  readonly address: string | undefined;
}

export function WalletDisplay({ address }: WalletDisplayProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available in all contexts;
      // the UI already reflects the non-copied state.
    }
  }, [address]);

  if (!address) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-mono">{truncateAddress(address)}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={handleCopy}
        aria-label={copied ? "Copied" : "Copy address"}
      >
        {copied ? (
          <>
            <Check className="h-3 w-3" />
            <span className="sr-only">Copied</span>
          </>
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </Button>
    </div>
  );
}
