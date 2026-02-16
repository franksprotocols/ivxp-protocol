"use client";

import { useCallback } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WalletMenu } from "./WalletMenu";

function getErrorMessage(error: Error): string {
  const message = error.message.toLowerCase();
  if (message.includes("rejected") || message.includes("denied")) {
    return "Connection request was rejected.";
  }
  if (message.includes("not found") || message.includes("not installed")) {
    return "Wallet not found. Please install a wallet extension.";
  }
  return "Failed to connect wallet. Please try again.";
}

export function ConnectButton() {
  const { address, isConnected, isConnecting } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();

  const handleCopyAddress = useCallback(async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      // Clipboard API may not be available in all contexts;
      // silently handled since there's no inline UI for this action.
    }
  }, [address]);

  const handleDisconnect = useCallback(() => {
    disconnect();
  }, [disconnect]);

  // Connected state: show wallet menu
  if (isConnected && address) {
    return (
      <WalletMenu
        address={address}
        onDisconnect={handleDisconnect}
        onCopyAddress={handleCopyAddress}
      />
    );
  }

  // Connecting state: show loading
  if (isConnecting || isPending) {
    return (
      <Button variant="outline" disabled>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Connecting...
      </Button>
    );
  }

  // Disconnected state: show connect options
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>
            <Wallet className="mr-2 h-4 w-4" />
            Connect Wallet
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {connectors.map((connector) => (
            <DropdownMenuItem
              key={connector.id}
              onClick={() => connect({ connector })}
              aria-label={`Connect with ${connector.name}`}
            >
              {connector.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {getErrorMessage(error)}
        </p>
      )}
    </>
  );
}
