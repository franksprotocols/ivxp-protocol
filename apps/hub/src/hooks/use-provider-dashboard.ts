import { useState, useEffect, useCallback, useRef } from "react";
import { useAccount, useSignMessage } from "wagmi";
import type { RegistryProviderWire } from "@/lib/registry/types";

export type DashboardState = "loading" | "loaded" | "not-found" | "error" | "disconnected";

export interface UseProviderDashboardReturn {
  provider: RegistryProviderWire | null;
  providers: RegistryProviderWire[];
  state: DashboardState;
  error: string | null;
  claimError: string | null;
  isClaiming: boolean;
  selectProvider: (providerId: string) => void;
  claimProvider: (endpointUrl: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

function buildClaimMessage(walletAddress: string, endpointUrl: string): string {
  return [
    "IVXP Provider Claim",
    `Wallet: ${walletAddress}`,
    `Endpoint: ${endpointUrl}`,
    `Timestamp: ${new Date().toISOString()}`,
  ].join("\n");
}

export function useProviderDashboard(): UseProviderDashboardReturn {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [providers, setProviders] = useState<RegistryProviderWire[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [state, setState] = useState<DashboardState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);

  const mountedRef = useRef(true);
  const selectedProviderIdRef = useRef<string | null>(selectedProviderId);

  useEffect(() => {
    selectedProviderIdRef.current = selectedProviderId;
  }, [selectedProviderId]);

  const fetchProviders = useCallback(async () => {
    if (!isConnected || !address) {
      setState("disconnected");
      setProviders([]);
      setSelectedProviderId(null);
      setError(null);
      setClaimError(null);
      return;
    }

    setState("loading");
    setError(null);

    try {
      const response = await fetch(`/api/registry/providers/mine?wallet_address=${address}`);

      if (!mountedRef.current) {
        return;
      }

      if (!response.ok) {
        const errorBody = await response.json();
        setError(errorBody.error?.message ?? "Failed to load provider data.");
        setState("error");
        return;
      }

      const data = (await response.json()) as { providers?: RegistryProviderWire[] };
      const mine = Array.isArray(data.providers) ? data.providers : [];

      if (mine.length === 0) {
        setProviders([]);
        setSelectedProviderId(null);
        setState("not-found");
        return;
      }

      const currentSelectedId = selectedProviderIdRef.current;
      const nextSelectedId = mine.some((provider) => provider.provider_id === currentSelectedId)
        ? currentSelectedId
        : mine[0].provider_id;

      setProviders(mine);
      setSelectedProviderId(nextSelectedId);
      setState("loaded");
    } catch {
      if (!mountedRef.current) {
        return;
      }
      setError("Network error. Please check your connection.");
      setState("error");
    }
  }, [address, isConnected]);

  useEffect(() => {
    mountedRef.current = true;
    fetchProviders();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchProviders]);

  const claimProvider = useCallback(
    async (endpointUrl: string): Promise<boolean> => {
      if (!address) {
        setClaimError("Please connect your wallet first.");
        return false;
      }

      setClaimError(null);
      setIsClaiming(true);

      try {
        const message = buildClaimMessage(address, endpointUrl);

        let signature: string;
        try {
          signature = await signMessageAsync({ message });
        } catch {
          setClaimError("Signature request was rejected.");
          return false;
        }

        const response = await fetch("/api/registry/providers/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint_url: endpointUrl,
            wallet_address: address,
            message,
            signature,
          }),
        });

        if (!response.ok) {
          const body = await response.json();
          setClaimError(body.error?.message ?? "Failed to claim provider.");
          return false;
        }

        await fetchProviders();
        return true;
      } catch {
        setClaimError("Network error while claiming provider.");
        return false;
      } finally {
        setIsClaiming(false);
      }
    },
    [address, fetchProviders, signMessageAsync],
  );

  const provider = providers.find((item) => item.provider_id === selectedProviderId) ?? null;

  return {
    provider,
    providers,
    state,
    error,
    claimError,
    isClaiming,
    selectProvider: setSelectedProviderId,
    claimProvider,
    refetch: fetchProviders,
  };
}
