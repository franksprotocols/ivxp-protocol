"use client";

import { useState } from "react";
import { isAddress } from "viem";
import type { ServiceDetail as ServiceDetailType } from "@/lib/types/service";
import { ServiceHeader } from "./ServiceHeader";
import { ProviderInfo } from "./ProviderInfo";
import { ServiceSchema } from "./ServiceSchema";
import { ServiceActions } from "./ServiceActions";
import type { ServiceQuote } from "@/hooks/use-service-request";
import { QuoteDialog, type Quote } from "@/components/features/quote-dialog";
import { PaymentDialog } from "@/components/features/payment-dialog";
import { ProviderRatingsSection } from "@/components/features/rating/ProviderRatingsSection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ServiceDetailProps {
  readonly service: ServiceDetailType;
}

export function ServiceDetail({ service }: ServiceDetailProps) {
  const description = service.long_description ?? service.description;
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [activeQuote, setActiveQuote] = useState<Quote | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);

  const handleQuoteReceived = (quote: ServiceQuote) => {
    if (!isAddress(quote.payment_address)) {
      setFlowError("Provider returned an invalid payment address. Please request a new quote.");
      return;
    }

    setFlowError(null);
    const nextQuote: Quote = {
      orderId: quote.order_id,
      serviceType: quote.service_type,
      priceUsdc: quote.price_usdc,
      providerAddress: quote.payment_address,
      providerId: quote.provider_id ?? service.provider_id,
      providerEndpointUrl:
        quote.provider_endpoint_url ?? service.provider_endpoint_url ?? service.provider_url,
      expiresAt: new Date(quote.expires_at),
    };
    setActiveQuote(nextQuote);
    setPaymentDialogOpen(false);
    setQuoteDialogOpen(true);
  };

  const handleQuoteConfirm = (quote: Quote) => {
    setActiveQuote(quote);
    setQuoteDialogOpen(false);
    setPaymentDialogOpen(true);
  };

  const handleRequestNewQuote = () => {
    setQuoteDialogOpen(false);
    setActiveQuote(null);
  };

  return (
    <div className="space-y-8" data-testid="service-detail">
      <ServiceHeader service={service} />
      {flowError && (
        <Alert variant="destructive" data-testid="service-flow-error">
          <AlertTitle>Quote Error</AlertTitle>
          <AlertDescription>{flowError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className="leading-relaxed text-muted-foreground"
                data-testid="service-description"
              >
                {description}
              </p>
            </CardContent>
          </Card>

          <ServiceSchema inputSchema={service.input_schema} outputSchema={service.output_schema} />

          {service.examples && service.examples.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Examples</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {service.examples.map((example) => (
                  <div
                    key={example.description ?? JSON.stringify(example.input)}
                    className="space-y-2 rounded-md border p-4"
                  >
                    {example.description && (
                      <p className="text-sm font-medium">{example.description}</p>
                    )}
                    <div>
                      <span className="text-xs text-muted-foreground">Input:</span>
                      <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-xs">
                        <code>{JSON.stringify(example.input, null, 2)}</code>
                      </pre>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Output:</span>
                      <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-xs">
                        <code>{JSON.stringify(example.output, null, 2)}</code>
                      </pre>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <ServiceActions service={service} onQuoteReceived={handleQuoteReceived} />
          <ProviderInfo service={service} />
          <ProviderRatingsSection providerAddress={service.provider_address} />
        </div>
      </div>

      {activeQuote && (
        <QuoteDialog
          open={quoteDialogOpen}
          onOpenChange={setQuoteDialogOpen}
          quote={activeQuote}
          onConfirm={handleQuoteConfirm}
          onRequestNewQuote={handleRequestNewQuote}
        />
      )}

      {activeQuote && (
        <PaymentDialog
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          orderId={activeQuote.orderId}
          priceUsdc={activeQuote.priceUsdc}
          providerAddress={activeQuote.providerAddress}
          onPaymentComplete={(_txHash, _blockNumber) => {}}
        />
      )}
    </div>
  );
}
