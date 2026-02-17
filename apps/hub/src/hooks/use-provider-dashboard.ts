import { useState, useEffect, useCallback, useRef } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import type { RegistryProviderWire } from "@/lib/registry/types";

export type DashboardState = "loading" | "loaded" | "not-found" | "error" | "disconnected";

export interface UseProviderDashboardReturn {
  provider: RegistryProviderWire | null;
  state: DashboardState;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useProviderDashboard(): UseProviderDashboardReturn {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const [provider, setProvider] = useState<RegistryProviderWire | null>(null);
  const [state, setState] = useState<DashboardState>("loading");
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchProvider = useCallback(async () => {
    if (!isConnected || !address) {
      setState("disconnected");
      setProvider(null);
      return;
    }

    setState("loading");
    setError(null);

    try {
      const response = await fetch(`/api/registry/providers/${address}`);

      if (!mountedRef.current) return;

      if (response.status === 404) {
        setState("not-found");
        setProvider(null);
        router.push("/provider/register");
        return;
      }

      if (!response.ok) {
        const errorBody = await response.json();
        setError(errorBody.error?.message ?? "Failed to load provider data.");
        setState("error");
        return;
      }

      const data = await response.json();
      setProvider(data.provider);
      setState("loaded");
    } catch {
      if (!mountedRef.current) return;
      setError("Network error. Please check your connection.");
      setState("error");
    }
  }, [address, isConnected, router]);

  useEffect(() => {
    mountedRef.current = true;
    fetchProvider();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchProvider]);

  return { provider, state, error, refetch: fetchProvider };
}
