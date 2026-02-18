"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAccount, useConnect } from "wagmi";
import { Loader2, Wallet, AlertCircle, CircleCheck } from "lucide-react";
import type { ServiceDetail } from "@/lib/types/service";
import { buildZodSchema, buildDefaultValues } from "@/lib/schema-to-zod";
import { useServiceRequest } from "@/hooks/use-service-request";
import type { ServiceQuote } from "@/hooks/use-service-request";
import { FieldRenderer } from "./field-renderer";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ServiceRequestFormProps {
  readonly service: ServiceDetail;
  readonly onQuoteReceived?: (quote: ServiceQuote) => void;
}

/**
 * Resolves the provider URL from service data.
 * Prefers the explicit provider_url field, falls back to a constructed URL.
 */
function resolveProviderUrl(service: ServiceDetail): string {
  if (service.provider_url) {
    return service.provider_url;
  }
  return `https://provider.ivxp.io/${service.provider_address}`;
}

/**
 * Dynamic service request form that adapts to the service's input_schema.
 *
 * Generates form fields, Zod validation, and handles the quote request flow.
 * Includes wallet connection guard and error/loading states.
 */
export function ServiceRequestForm({ service, onQuoteReceived }: ServiceRequestFormProps) {
  const { isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { submitRequest, isLoading, error, reset } = useServiceRequest();
  const [latestQuote, setLatestQuote] = useState<ServiceQuote | null>(null);

  const schema = buildZodSchema(service.input_schema);
  const defaultValues = buildDefaultValues(service.input_schema);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });

  // Wallet connection guard (AC #4)
  if (!isConnected) {
    return (
      <div
        className="flex flex-col items-center gap-4 rounded-lg border border-dashed p-8"
        data-testid="wallet-connect-prompt"
      >
        <Wallet className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <p className="text-center text-sm text-muted-foreground">
          Connect your wallet to request this service
        </p>
        {connectors.length > 0 && (
          <Button
            variant="outline"
            onClick={() => connect({ connector: connectors[0] })}
            data-testid="wallet-connect-button"
          >
            <Wallet className="mr-2 h-4 w-4" aria-hidden="true" />
            Connect Wallet
          </Button>
        )}
      </div>
    );
  }

  const onSubmit = async (data: Record<string, unknown>) => {
    setLatestQuote(null);
    const providerUrl = resolveProviderUrl(service);
    const quote = await submitRequest(service.service_type, providerUrl, data);
    if (quote) {
      setLatestQuote(quote);
      onQuoteReceived?.(quote);
    }
  };

  const requiredFields = new Set(service.input_schema.required ?? []);
  const properties = Object.entries(service.input_schema.properties);

  return (
    <div className="space-y-4" data-testid="service-request-form">
      {/* Error display (AC #5) */}
      {error && (
        <Alert variant="destructive" data-testid="request-error">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Request Failed</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{error.message}</span>
            <Button variant="outline" size="sm" onClick={reset} data-testid="retry-button">
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {isLoading && (
        <Alert data-testid="request-pending">
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertTitle>Request Sent</AlertTitle>
          <AlertDescription>Waiting for provider response...</AlertDescription>
        </Alert>
      )}
      {latestQuote && !isLoading && !error && (
        <Alert data-testid="request-success">
          <CircleCheck className="h-4 w-4" />
          <AlertTitle>Quote Received</AlertTitle>
          <AlertDescription>
            order_id: <code>{latestQuote.order_id}</code>
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {properties.map(([fieldName, property]) => {
          const isRequired = requiredFields.has(fieldName) || property.required === true;

          return (
            <FieldRenderer
              key={fieldName}
              name={fieldName}
              property={property}
              required={isRequired}
              form={form}
            />
          );
        })}

        <Button
          type="submit"
          className="w-full"
          disabled={isLoading}
          data-testid="submit-request-button"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Requesting Quote...
            </>
          ) : (
            "Request Quote"
          )}
        </Button>
      </form>
    </div>
  );
}
