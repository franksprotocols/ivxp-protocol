import { useState, useCallback } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useRouter } from "next/navigation";
import { buildRegistrationMessage } from "@/lib/registry/verify-signature";
import type { ProviderRegistrationFormData } from "@/lib/provider-registration-schema";

export type RegistrationState = "idle" | "signing" | "submitting" | "success" | "error";

export interface RegistrationError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

export interface UseProviderRegistrationReturn {
  register: (data: ProviderRegistrationFormData) => Promise<void>;
  state: RegistrationState;
  error: RegistrationError | null;
  reset: () => void;
}

const API_ERROR_MESSAGES: Record<string, string> = {
  SIGNATURE_INVALID: "Signature verification failed. Please try again.",
  PROVIDER_ALREADY_REGISTERED: "A provider with this wallet address is already registered.",
  PROVIDER_UNREACHABLE:
    "Provider endpoint is not reachable. Please check your URL and ensure your provider is running.",
  INVALID_PARAMETERS: "Some fields have validation errors. Please review and correct them.",
  INTERNAL_ERROR: "An unexpected error occurred. Please try again later.",
};

export function useProviderRegistration(): UseProviderRegistrationReturn {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const router = useRouter();
  const [state, setState] = useState<RegistrationState>("idle");
  const [error, setError] = useState<RegistrationError | null>(null);

  const reset = useCallback(() => {
    setState("idle");
    setError(null);
  }, []);

  const register = useCallback(
    async (data: ProviderRegistrationFormData) => {
      if (!address) {
        setError({ code: "WALLET_NOT_CONNECTED", message: "Please connect your wallet first." });
        setState("error");
        return;
      }

      try {
        // 1. Build canonical registration message
        setState("signing");
        setError(null);
        const timestamp = new Date().toISOString();
        const message = buildRegistrationMessage({
          providerAddress: address,
          name: data.name,
          endpointUrl: data.endpointUrl,
          timestamp,
        });

        // 2. Request EIP-191 signature from wallet
        let signature: string;
        try {
          signature = await signMessageAsync({ message });
        } catch {
          setError({
            code: "SIGNATURE_REJECTED",
            message: "Signature rejected. Please try again.",
          });
          setState("error");
          return;
        }

        // 3. Transform to wire format and submit
        setState("submitting");
        const wirePayload = {
          provider_address: address,
          name: data.name,
          description: data.description,
          endpoint_url: data.endpointUrl,
          services: data.services.map((s) => ({
            service_type: s.serviceType,
            name: s.name,
            description: s.description,
            price_usdc: s.priceUsdc,
            estimated_time_seconds: s.estimatedTimeSeconds,
          })),
          signature,
          message,
        };

        const response = await fetch("/api/registry/providers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(wirePayload),
        });

        if (!response.ok) {
          const errorBody = await response.json();
          const apiError = errorBody.error;
          setError({
            code: apiError?.code ?? "UNKNOWN_ERROR",
            message:
              API_ERROR_MESSAGES[apiError?.code] ?? apiError?.message ?? "Registration failed.",
            details: apiError?.details,
          });
          setState("error");
          return;
        }

        // 4. Success - redirect to provider entry page
        setState("success");
        router.push("/provider");
      } catch {
        setError({
          code: "NETWORK_ERROR",
          message: "Network error. Please check your connection and try again.",
        });
        setState("error");
      }
    },
    [address, signMessageAsync, router],
  );

  return { register, state, error, reset };
}
