"use client";

/**
 * PaymentDialog -- Multi-step payment dialog for USDC transfers.
 *
 * Orchestrates the full payment flow: balance check, ERC-20 approval,
 * USDC transfer, and on-chain confirmation. Handles error states
 * including insufficient balance, wallet rejection, and partial success.
 */

import { useEffect, useRef, useState } from "react";
import type { Address } from "viem";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Wallet } from "lucide-react";
import { usePayment } from "@/hooks/use-payment";
import { PaymentSteps } from "./payment-steps";
import { TransactionLink } from "./transaction-link";
import { RecoveryPanel } from "./recovery-panel";
import { SignatureDialog } from "@/components/features/signature-dialog";
import { CopyButton } from "@/components/features/protocol-visibility/copy-button";
import { ProtocolTooltip } from "@/components/features/protocol-visibility/protocol-tooltip";

export interface PaymentDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly orderId: string;
  readonly priceUsdc: string;
  readonly providerAddress: Address;
  readonly onPaymentComplete: (txHash: `0x${string}`, blockNumber: bigint) => void;
}

export function PaymentDialog({
  open,
  onOpenChange,
  orderId,
  priceUsdc,
  providerAddress,
  onPaymentComplete,
}: PaymentDialogProps) {
  const payment = usePayment(orderId);
  const initiatedRef = useRef(false);
  const initiatePaymentRef = useRef(payment.initiatePayment);
  initiatePaymentRef.current = payment.initiatePayment;
  const [showSignature, setShowSignature] = useState(false);
  // Issue #4: Track if signature dialog was already opened to prevent re-fires
  const signatureOpenedRef = useRef(false);

  // Auto-start payment when dialog opens
  useEffect(() => {
    let mounted = true;
    if (open && payment.step === "idle" && !initiatedRef.current) {
      initiatedRef.current = true;
      if (mounted) {
        initiatePaymentRef.current(providerAddress, priceUsdc);
      }
    }
    if (!open) {
      initiatedRef.current = false;
      // Issue #10: Reset signature state when dialog closes
      signatureOpenedRef.current = false;
    }
    return () => {
      mounted = false;
    };
  }, [open, payment.step, providerAddress, priceUsdc]);

  // Notify parent when payment is confirmed (issue #10: mounted guard)
  useEffect(() => {
    let mounted = true;
    if (mounted && payment.step === "confirmed" && payment.txHash && payment.blockNumber !== null) {
      onPaymentComplete(payment.txHash, payment.blockNumber);
    }
    return () => {
      mounted = false;
    };
  }, [payment.step, payment.txHash, payment.blockNumber, onPaymentComplete]);

  // Auto-open SignatureDialog when payment is confirmed (issue #4: ref guard)
  useEffect(() => {
    if (payment.step === "confirmed" && payment.txHash && !signatureOpenedRef.current) {
      signatureOpenedRef.current = true;
      setShowSignature(true);
    }
  }, [payment.step, payment.txHash]);

  const canClose =
    payment.step === "idle" ||
    payment.step === "error" ||
    payment.step === "confirmed" ||
    payment.step === "partial-success";

  const isNonRecoverableError =
    payment.error?.code === "INSUFFICIENT_BALANCE" ||
    payment.error?.code === "WALLET_NOT_CONNECTED" ||
    payment.error?.code === "WRONG_CHAIN" ||
    payment.error?.code === "USDC_NOT_CONFIGURED" ||
    payment.error?.code === "CLIENT_UNAVAILABLE";

  return (
    <Dialog open={open} onOpenChange={canClose ? onOpenChange : undefined}>
      <DialogContent
        onPointerDownOutside={canClose ? undefined : (e) => e.preventDefault()}
        onEscapeKeyDown={canClose ? undefined : (e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Payment</DialogTitle>
          <DialogDescription>Sending {priceUsdc} USDC to provider</DialogDescription>
        </DialogHeader>

        {/* Balance display */}
        {payment.balance !== null && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Wallet className="h-4 w-4" />
            <span>Balance: {payment.balance} USDC</span>
          </div>
        )}

        {/* Step progress */}
        <PaymentSteps currentStep={payment.step} />

        {/* Transaction link with protocol visibility */}
        {payment.txHash && payment.step !== "partial-success" && (
          <div className="space-y-2">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                Transaction
                <ProtocolTooltip field="tx_hash" />
              </p>
              <TransactionLink txHash={payment.txHash} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                Order ID
                <ProtocolTooltip field="order_id" />
              </p>
              <div className="flex items-center gap-1">
                <code className="font-mono text-sm">{orderId}</code>
                <CopyButton value={orderId} label="order ID" />
              </div>
            </div>
          </div>
        )}

        {/* Non-recoverable error (insufficient balance, wrong chain, etc.) */}
        {payment.step === "error" && isNonRecoverableError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>
              {payment.error?.code === "INSUFFICIENT_BALANCE"
                ? "Insufficient USDC Balance"
                : "Payment Error"}
            </AlertTitle>
            <AlertDescription>{payment.error?.message}</AlertDescription>
          </Alert>
        )}

        {/* Recoverable error with retry (Fix #11: loading state) */}
        {payment.step === "error" && !isNonRecoverableError && (
          <div className="space-y-3">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Payment Error</AlertTitle>
              <AlertDescription>{payment.error?.message}</AlertDescription>
            </Alert>
            <Button onClick={payment.retry} disabled={payment.isRetrying} className="w-full">
              {payment.isRetrying ? "Retrying..." : "Retry"}
            </Button>
          </div>
        )}

        {/* Partial success recovery (Fix #11: pass isRetrying) */}
        {payment.step === "partial-success" && payment.txHash && (
          <RecoveryPanel
            txHash={payment.txHash}
            onRetry={payment.retryVerification}
            isRetrying={payment.isRetrying}
          />
        )}

        {/* Success state -- transition to identity signature */}
        {payment.step === "confirmed" && (
          <div className="text-center space-y-2">
            <p className="text-sm font-medium text-green-600">Payment confirmed</p>
            <p className="text-xs text-muted-foreground">Proceeding to identity verification...</p>
          </div>
        )}
      </DialogContent>

      {/* SignatureDialog auto-opens after payment confirmation */}
      {showSignature && payment.txHash && (
        <SignatureDialog
          open={showSignature}
          onOpenChange={(isOpen) => {
            setShowSignature(isOpen);
            if (!isOpen) {
              onOpenChange(false);
            }
          }}
          orderId={orderId}
          txHash={payment.txHash}
        />
      )}
    </Dialog>
  );
}
