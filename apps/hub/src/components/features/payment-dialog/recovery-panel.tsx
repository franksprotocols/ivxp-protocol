/**
 * RecoveryPanel -- UI for PartialSuccessError recovery.
 *
 * Shown when the USDC transfer succeeded on-chain but provider
 * notification or verification failed. Displays the transaction hash
 * prominently with a copy button, block explorer link, retry button,
 * and instructions to contact the provider.
 */

import { AlertTriangle } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TransactionLink } from "./transaction-link";

interface RecoveryPanelProps {
  readonly txHash: string;
  readonly onRetry: () => void;
  readonly isRetrying?: boolean;
}

export function RecoveryPanel({ txHash, onRetry, isRetrying = false }: RecoveryPanelProps) {
  return (
    <div className="space-y-4">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Payment sent but verification failed</AlertTitle>
        <AlertDescription>
          Your USDC transfer was submitted on-chain, but we could not verify it with the provider.
          Your funds are safe.
        </AlertDescription>
      </Alert>

      <div className="rounded-md border p-4 space-y-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Transaction Hash</p>
          <TransactionLink txHash={txHash} />
        </div>

        <div className="space-y-2">
          <Button onClick={onRetry} disabled={isRetrying} className="w-full">
            {isRetrying ? "Retrying..." : "Retry Verification"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            If retry fails, contact the provider with your transaction hash above.
          </p>
        </div>
      </div>
    </div>
  );
}
