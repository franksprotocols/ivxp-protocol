"use client";

import { useCallback, useMemo, useState } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import {
  isSupportedChain,
  getTargetChain,
  getChainName,
  UNKNOWN_CHAIN_NAME,
} from "@/lib/network-constants";

export type NetworkSwitchError = "user-rejected" | "unsupported" | "unknown";

function classifyError(error: Error): NetworkSwitchError {
  const name = error.name ?? "";
  if (name === "UserRejectedRequestError" || name.includes("Rejected")) {
    return "user-rejected";
  }
  if (name === "SwitchChainNotSupportedError" || name.includes("NotSupported")) {
    return "unsupported";
  }

  const message = error.message.toLowerCase();
  if (message.includes("rejected") || message.includes("denied")) {
    return "user-rejected";
  }
  if (message.includes("not supported") || message.includes("unrecognized chain")) {
    return "unsupported";
  }

  return "unknown";
}

function formatChainName(chainId: number): string {
  const name = getChainName(chainId);
  return name === UNKNOWN_CHAIN_NAME ? `${name} (${chainId})` : name;
}

export interface NetworkStatus {
  readonly isConnected: boolean;
  readonly isWrongNetwork: boolean;
  readonly currentChainId: number | undefined;
  readonly currentChainName: string;
  readonly targetChainName: string;
  readonly targetChainId: number;
  readonly isSwitching: boolean;
  readonly switchError: NetworkSwitchError | null;
  readonly switchToTarget: () => void;
  readonly clearError: () => void;
}

export function useNetworkStatus(): NetworkStatus {
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  const [switchError, setSwitchError] = useState<NetworkSwitchError | null>(null);

  const targetChain = useMemo(() => getTargetChain(), []);
  const isWrongNetwork = isConnected && !isSupportedChain(chainId);

  const switchToTarget = useCallback(() => {
    setSwitchError(null);
    switchChain(
      { chainId: targetChain.id },
      {
        onError: (error: Error) => {
          setSwitchError(classifyError(error));
        },
      },
    );
  }, [switchChain, targetChain.id]);

  const clearError = useCallback(() => {
    setSwitchError(null);
  }, []);

  return {
    isConnected,
    isWrongNetwork,
    currentChainId: isConnected ? chainId : undefined,
    currentChainName: isConnected ? formatChainName(chainId) : "",
    targetChainName: targetChain.name,
    targetChainId: targetChain.id,
    isSwitching: isPending,
    switchError,
    switchToTarget,
    clearError,
  };
}
