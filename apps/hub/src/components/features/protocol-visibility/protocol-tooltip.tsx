"use client";

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ---------------------------------------------------------------------------
// Educational descriptions for protocol fields
// ---------------------------------------------------------------------------

export const PROTOCOL_TOOLTIPS = {
  order_id:
    "A unique identifier assigned to each service order. Use it to track your order across the IVXP protocol.",
  tx_hash:
    "The blockchain transaction hash proving your USDC payment was recorded on Base L2. Click the link to verify on BaseScan.",
  signature:
    "An EIP-191 cryptographic signature proving your wallet authorized this order. The Provider verifies this before processing.",
  content_hash:
    "A SHA-256 hash of the deliverable content. Verify it to confirm the deliverable has not been tampered with.",
  status:
    "The current lifecycle stage of your order: Quoted, Paid, Processing, or Delivered.",
  provider:
    "The Ethereum address of the service provider fulfilling your order.",
  signed_message:
    "The plaintext message that was signed with your wallet's private key for identity verification.",
} as const;

export type ProtocolField = keyof typeof PROTOCOL_TOOLTIPS;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ProtocolTooltipProps {
  readonly field: ProtocolField;
  readonly children?: React.ReactNode;
}

/**
 * Educational tooltip that explains a protocol field.
 * Wraps an info icon (or custom children) with a Radix tooltip.
 */
export function ProtocolTooltip({ field, children }: ProtocolTooltipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          {children ?? (
            <button
              type="button"
              className="inline-flex items-center text-muted-foreground hover:text-foreground"
              aria-label={`Learn about ${field.replace(/_/g, " ")}`}
            >
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>{PROTOCOL_TOOLTIPS[field]}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
