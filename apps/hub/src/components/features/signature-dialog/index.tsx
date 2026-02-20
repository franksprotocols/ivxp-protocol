"use client";

/**
 * SignatureDialog -- Identity verification dialog for EIP-191 signing.
 *
 * Displayed after payment confirmation. Prompts the user to sign a
 * gasless message proving wallet ownership, then submits the delivery
 * request to the provider.
 */

import { useMemo } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import {
  useIdentitySignature,
  SIGNATURE_ERROR_CODES,
  type SignatureStep,
} from "@/hooks/use-identity-signature";
import { CopyButton } from "@/components/features/protocol-visibility/copy-button";
import { ProtocolTooltip } from "@/components/features/protocol-visibility/protocol-tooltip";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SignatureDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly orderId: string;
  readonly txHash: `0x${string}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPreviewMessage(orderId: string, address?: string): string {
  return `IVXP Identity Verification | Order: ${orderId} | Address: ${address ?? "<not connected>"} | Timestamp: <now>`;
}

function isSigningOrSubmitting(step: SignatureStep): boolean {
  return step === "signing" || step === "submitting";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SignatureDialog({ open, onOpenChange, orderId, txHash }: SignatureDialogProps) {
  const { address } = useAccount();
  const { step, error, errorCode, signature, message, signAndDeliver, retryDelivery } =
    useIdentitySignature({
      orderId,
      txHash,
    });

  const previewMessage = useMemo(
    () => message ?? buildPreviewMessage(orderId, address),
    [message, orderId, address],
  );

  const isBusy = isSigningOrSubmitting(step);
  // Issue #13: Use errorCode instead of magic string matching
  const isRejectionError = errorCode === SIGNATURE_ERROR_CODES.USER_REJECTED;
  const isDeliveryError = step === "error" && signature !== null && !isRejectionError;

  const handleCancel = () => {
    onOpenChange(false);
  };

  const handleRetry = () => {
    if (isDeliveryError) {
      retryDelivery();
    } else {
      signAndDeliver();
    }
  };

  return (
    <Dialog open={open} onOpenChange={isBusy ? undefined : onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verify Your Identity</DialogTitle>
          <DialogDescription>
            Sign a message to prove wallet ownership. Free, no gas required.
          </DialogDescription>
        </DialogHeader>

        <div
          data-testid="signature-message"
          className="rounded-md bg-muted p-3 font-mono text-xs break-all"
        >
          {previewMessage}
        </div>

        {/* Signature display with verification indicator */}
        {signature && (
          <div data-testid="signature-display" className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-1">
                EIP-191 Signature
                <ProtocolTooltip field="signature" />
              </span>
              {step === "submitted" ? (
                <Badge className="gap-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                  Verified
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                  Signed
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <code className="flex-1 font-mono text-xs break-all text-muted-foreground">
                {signature}
              </code>
              <CopyButton value={signature} label="signature" />
            </div>
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Issue #5: aria-live region for screen reader announcements */}
        <div aria-live="polite" className="sr-only">
          {step === "idle" && "Ready to sign message."}
          {step === "signing" && "Signing message with your wallet..."}
          {step === "submitting" && "Submitting delivery request..."}
          {step === "submitted" && "Delivery request submitted successfully."}
          {step === "error" && error}
        </div>

        <DialogFooter>
          {step === "error" ? (
            <>
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleRetry}>
                {isRejectionError ? "Retry Signature" : "Retry"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleCancel} disabled={isBusy}>
                Cancel
              </Button>
              <Button onClick={signAndDeliver} disabled={isBusy} aria-busy={isBusy}>
                {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                {step === "signing"
                  ? "Signing..."
                  : step === "submitting"
                    ? "Submitting..."
                    : "Sign Message"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
