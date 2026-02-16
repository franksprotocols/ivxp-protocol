/**
 * TransactionLink -- Displays a truncated transaction hash as a clickable
 * link to the Base block explorer.
 */

import { ExternalLink, Copy, Check } from "lucide-react";
import { useState, useCallback } from "react";
import { getExplorerTxUrl } from "@/lib/usdc-contract";

interface TransactionLinkProps {
  readonly txHash: string;
}

export function TransactionLink({ txHash }: TransactionLinkProps) {
  const [copied, setCopied] = useState(false);
  const explorerUrl = getExplorerTxUrl(txHash);
  const truncated = `${txHash.slice(0, 10)}...${txHash.slice(-8)}`;

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(txHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [txHash]);

  return (
    <div className="flex items-center gap-2">
      <a
        href={explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-mono text-sm text-blue-600 hover:underline"
        aria-label={`View transaction ${txHash} on block explorer`}
      >
        {truncated}
        <ExternalLink className="h-3 w-3" />
      </a>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center text-muted-foreground hover:text-foreground"
        aria-label="Copy transaction hash"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  );
}
