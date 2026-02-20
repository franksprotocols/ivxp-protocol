import { useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { useIVXPClient } from "./use-ivxp-client";

/**
 * Represents a service quote returned by the provider.
 * Uses snake_case to match the wire protocol format.
 */
export interface ServiceQuote {
  readonly order_id: string;
  readonly price_usdc: string;
  readonly payment_address: string;
  readonly expires_at: string;
  readonly service_type: string;
  readonly request_input?: Record<string, unknown>;
  readonly provider_id?: string;
  readonly provider_endpoint_url?: string;
}

export interface ServiceRequestError {
  readonly message: string;
  readonly code: string;
}

export interface UseServiceRequestReturn {
  readonly submitRequest: (
    serviceType: string,
    providerUrl: string,
    input: Record<string, unknown>,
  ) => Promise<ServiceQuote | null>;
  readonly isLoading: boolean;
  readonly error: ServiceRequestError | null;
  readonly reset: () => void;
}

/**
 * Hook for submitting service requests and managing request state.
 *
 * Manages loading, error, and success states for the quote request flow.
 */
export function useServiceRequest(): UseServiceRequestReturn {
  const { address } = useAccount();
  const client = useIVXPClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ServiceRequestError | null>(null);

  const reset = useCallback(() => {
    setError(null);
  }, []);

  const submitRequest = useCallback(
    async (
      serviceType: string,
      providerUrl: string,
      input: Record<string, unknown>,
    ): Promise<ServiceQuote | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const quote = await client.requestQuote(providerUrl, {
          service_type: serviceType,
          input,
          client_address: address,
        });

        const quoteWithInput: ServiceQuote = {
          ...quote,
          request_input: input,
        };

        client.emit("order.quoted", {
          orderId: quoteWithInput.order_id,
          priceUsdc: quoteWithInput.price_usdc,
        });

        return quoteWithInput;
      } catch (err) {
        const requestError: ServiceRequestError = {
          message: err instanceof Error ? err.message : "Request failed.",
          code:
            err instanceof Error && "code" in err && typeof err.code === "string"
              ? err.code
              : "REQUEST_FAILED",
        };
        setError(requestError);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [address, client],
  );

  return { submitRequest, isLoading, error, reset };
}
