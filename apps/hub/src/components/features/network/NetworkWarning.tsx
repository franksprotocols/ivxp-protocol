"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNetworkStatus, type NetworkSwitchError } from "./use-network-status";

function getErrorMessage(error: NetworkSwitchError): string {
  switch (error) {
    case "user-rejected":
      return "Network switch was rejected. Please try again.";
    case "unsupported":
      return "Your wallet does not support automatic switching. Please switch to the correct network manually in your wallet settings.";
    case "unknown":
      return "Failed to switch network. Please try again or switch manually.";
  }
}

export function NetworkWarning() {
  const {
    isWrongNetwork,
    currentChainName,
    targetChainName,
    isSwitching,
    switchError,
    switchToTarget,
  } = useNetworkStatus();

  if (!isWrongNetwork) {
    return null;
  }

  return (
    <div
      role="alert"
      className="w-full border-b border-amber-300 bg-amber-50 px-4 py-3 text-amber-900"
    >
      <div className="container mx-auto flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p className="text-sm">
            <span className="font-semibold">Wrong network.</span> You are connected to{" "}
            <span className="font-medium">{currentChainName}</span>. Please switch to{" "}
            <span className="font-medium">{targetChainName}</span>.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={isSwitching}
          onClick={switchToTarget}
          className="shrink-0 border-amber-400 bg-amber-100 text-amber-900 hover:bg-amber-200"
        >
          {isSwitching ? (
            <>
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Switching...
            </>
          ) : (
            `Switch Network`
          )}
        </Button>
      </div>
      {switchError && (
        <p role="status" aria-live="polite" className="mt-2 text-xs text-amber-800">
          {getErrorMessage(switchError)}
        </p>
      )}
    </div>
  );
}
