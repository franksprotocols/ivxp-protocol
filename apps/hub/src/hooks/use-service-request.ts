import { useState, useCallback } from "react";
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
 * Simulates a requestQuote call to a provider.
 * In production, this would use the IVXPClient SDK.
 * URLs containing "FAIL" trigger an error for testing.
 */
async function mockRequestQuote(
  serviceType: string,
  providerUrl: string,
  _input: Record<string, unknown>,
): Promise<ServiceQuote> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  if (providerUrl.includes("FAIL")) {
    throw new Error("Provider unreachable: connection refused");
  }

  return {
    order_id: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    price_usdc: "1.00",
    payment_address: "0x1234567890abcdef1234567890abcdef12345678",
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    service_type: serviceType,
  };
}

/**
 * Hook for submitting service requests and managing request state.
 *
 * Manages loading, error, and success states for the quote request flow.
 * Currently uses a mock implementation; will be wired to IVXPClient SDK
 * when the full provider integration is available.
 */
export function useServiceRequest(): UseServiceRequestReturn {
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
        const quote = await mockRequestQuote(serviceType, providerUrl, input);
        client?.emit?.("order.quoted", {
          orderId: quote.order_id,
          priceUsdc: quote.price_usdc,
        });
        return quote;
      } catch (err) {
        const requestError: ServiceRequestError = {
          message: err instanceof Error ? err.message : "Request failed",
          code: "REQUEST_FAILED",
        };
        setError(requestError);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [client],
  );

  return { submitRequest, isLoading, error, reset };
}
