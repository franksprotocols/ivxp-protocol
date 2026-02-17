import { useState, useCallback } from "react";
import { useAccount, useSignMessage } from "wagmi";
import type { ProviderUpdateFormData } from "@/lib/provider-update-schema";
import type { RegistryProviderWire } from "@/lib/registry/types";

export type UpdateState = "idle" | "signing" | "submitting" | "success" | "error";

export interface UpdateError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

export interface UseProviderUpdateReturn {
  update: (data: ProviderUpdateFormData) => Promise<RegistryProviderWire | null>;
  state: UpdateState;
  error: UpdateError | null;
  reset: () => void;
}

const API_ERROR_MESSAGES: Record<string, string> = {
  WALLET_NOT_CONNECTED: "Please connect your wallet first.",
  SIGNATURE_REJECTED: "Signature was rejected. Please try again to sign the update message.",
  SIGNATURE_INVALID: "Signature verification failed. Please try again.",
  PROVIDER_NOT_FOUND: "Provider not found. Your registration may have been removed.",
  PROVIDER_UNREACHABLE:
    "Provider endpoint is not reachable. Please check your URL and ensure your provider is running.",
  INVALID_PARAMETERS: "Some fields have validation errors. Please review and correct them.",
  INTERNAL_ERROR: "An unexpected error occurred. Please try again later.",
  NETWORK_ERROR: "Network error. Please check your connection and try again.",
};

export function useProviderUpdate(): UseProviderUpdateReturn {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [state, setState] = useState<UpdateState>("idle");
  const [error, setError] = useState<UpdateError | null>(null);

  const reset = useCallback(() => {
    setState("idle");
    setError(null);
  }, []);

  const update = useCallback(
    async (data: ProviderUpdateFormData): Promise<RegistryProviderWire | null> => {
      if (!address) {
        setError({
          code: "WALLET_NOT_CONNECTED",
          message: API_ERROR_MESSAGES.WALLET_NOT_CONNECTED,
        });
        setState("error");
        return null;
      }

      try {
        // Build canonical update message
        setState("signing");
        setError(null);
        const timestamp = new Date().toISOString();
        const message = [
          "IVXP Provider Update",
          `Provider: ${address}`,
          `Name: ${data.name}`,
          `Endpoint: ${data.endpointUrl}`,
          `Timestamp: ${timestamp}`,
        ].join("\n");

        // Request EIP-191 signature
        let signature: string;
        try {
          signature = await signMessageAsync({ message });
        } catch {
          setError({
            code: "SIGNATURE_REJECTED",
            message: API_ERROR_MESSAGES.SIGNATURE_REJECTED,
          });
          setState("error");
          return null;
        }

        // Transform to wire format and submit
        setState("submitting");
        const wirePayload = {
          name: data.name,
          description: data.description,
          endpoint_url: data.endpointUrl,
          signature,
          message,
        };

        const response = await fetch(`/api/registry/providers/${address}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(wirePayload),
        });

        if (!response.ok) {
          const errorBody = await response.json();
          const apiError = errorBody.error;
          setError({
            code: apiError?.code ?? "UNKNOWN_ERROR",
            message: API_ERROR_MESSAGES[apiError?.code] ?? apiError?.message ?? "Update failed.",
            details: apiError?.details,
          });
          setState("error");
          return null;
        }

        const responseData = await response.json();
        setState("success");
        return responseData.provider;
      } catch {
        setError({
          code: "NETWORK_ERROR",
          message: API_ERROR_MESSAGES.NETWORK_ERROR,
        });
        setState("error");
        return null;
      }
    },
    [address, signMessageAsync],
  );

  return { update, state, error, reset };
}
