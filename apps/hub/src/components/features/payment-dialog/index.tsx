"use client";

/**
 * PaymentDialog -- Multi-step payment dialog for USDC transfers.
 *
 * Orchestrates the full payment flow: balance check, ERC-20 approval,
 * USDC transfer, and on-chain confirmation. Handles error states
 * including insufficient balance, wallet rejection, and partial success.
 */

import { useEffect, useRef } from "react";
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

  // Auto-start payment when dialog opens
  useEffect(() => {
    if (open && payment.step === "idle" && !initiatedRef.current) {
      initiatedRef.current = true;
      initiatePaymentRef.current(providerAddress, priceUsdc);
    }
    if (!open) {
      initiatedRef.current = false;
    }
  }, [open, payment.step, providerAddress, priceUsdc]);

  // Notify parent when payment is confirmed
  useEffect(() => {
    if (payment.step === "confirmed" && payment.txHash && payment.blockNumber !== null) {
      onPaymentComplete(payment.txHash, payment.blockNumber);
    }
  }, [payment.step, payment.txHash, payment.blockNumber, onPaymentComplete]);

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

        {/* Transaction link */}
        {payment.txHash && payment.step !== "partial-success" && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Transaction</p>
            <TransactionLink txHash={payment.txHash} />
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

        {/* Success state */}
        {payment.step === "confirmed" && (
          <div className="text-center space-y-2">
            <p className="text-sm font-medium text-green-600">Payment confirmed</p>
            <Button onClick={() => onOpenChange(false)} variant="outline">
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
