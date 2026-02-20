"use client";

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ServiceDetail } from "@/lib/types/service";
import { MOCK_SERVICE_DETAILS } from "@/lib/mock-data/service-details";

type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

interface DemoProviderInfoProps {
  readonly url: string;
  readonly onCatalogLoaded?: (services: readonly ServiceDetail[]) => void;
}

interface CatalogResponse {
  readonly services?: readonly Record<string, unknown>[];
  readonly provider_address?: string;
  readonly provider_name?: string;
}

function resolveServiceType(service: Record<string, unknown>): string | null {
  const serviceType = service["service_type"];
  if (typeof serviceType === "string" && serviceType.length > 0) return serviceType;
  const type = service["type"];
  if (typeof type === "string" && type.length > 0) return type;
  return null;
}

function resolvePriceUsdc(
  service: Record<string, unknown>,
  fallbackPrice: string | undefined,
): string {
  const priceUsdc = service["price_usdc"];
  if (typeof priceUsdc === "string" && priceUsdc.length > 0) return priceUsdc;
  if (typeof priceUsdc === "number" && Number.isFinite(priceUsdc) && priceUsdc >= 0) {
    return priceUsdc.toFixed(2);
  }

  const basePrice = service["base_price_usdc"];
  if (typeof basePrice === "number" && Number.isFinite(basePrice) && basePrice >= 0) {
    return basePrice.toFixed(2);
  }

  return fallbackPrice ?? "0.10";
}

function toServiceDetails(
  rawServices: readonly Record<string, unknown>[],
): readonly ServiceDetail[] {
  const details: ServiceDetail[] = [];

  for (const rawService of rawServices) {
    const serviceType = resolveServiceType(rawService);
    if (!serviceType) continue;

    const template = MOCK_SERVICE_DETAILS.find((service) => service.service_type === serviceType);
    if (!template) continue;

    details.push({
      ...template,
      price_usdc: resolvePriceUsdc(rawService, template.price_usdc),
    });
  }

  return details;
}

/**
 * Classifies fetch errors into specific user-friendly messages.
 */
function classifyError(err: unknown): string {
  if (err instanceof DOMException && err.name === "AbortError") {
    return "Request timed out. The provider may be unavailable.";
  }
  if (err instanceof DOMException && err.name === "TimeoutError") {
    return "Request timed out. The provider may be unavailable.";
  }
  if (err instanceof TypeError && err.message.includes("fetch")) {
    return "Network error. Check your internet connection.";
  }
  if (err instanceof SyntaxError) {
    return "Invalid response from provider. Could not parse catalog data.";
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Failed to connect to provider.";
}

async function fetchCatalog(
  url: string,
  signal: AbortSignal,
): Promise<{ services: readonly ServiceDetail[]; error: string | null }> {
  try {
    const response = await fetch(`${url}/ivxp/catalog`, {
      signal,
    });
    if (!response.ok) {
      return {
        services: [],
        error: `Server returned HTTP ${response.status} (${response.statusText || "error"})`,
      };
    }
    const data = (await response.json()) as CatalogResponse;
    const rawServices = Array.isArray(data.services) ? data.services : [];
    return { services: toServiceDetails(rawServices), error: null };
  } catch (err) {
    return { services: [], error: classifyError(err) };
  }
}

export function DemoProviderInfo({ url, onCatalogLoaded }: DemoProviderInfoProps) {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [services, setServices] = useState<readonly ServiceDetail[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setStatus("connecting");
    setErrorMessage(null);

    fetchCatalog(url, controller.signal).then(({ services: fetched, error }) => {
      if (cancelled) return;
      if (error) {
        setStatus("error");
        setErrorMessage(error);
        return;
      }
      setServices(fetched);
      setStatus("connected");
      onCatalogLoaded?.(fetched);
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
    // onCatalogLoaded intentionally excluded to avoid re-fetch loops
  }, [url]);

  return (
    <Card data-testid="demo-provider-info">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Demo Provider
          <StatusIndicator status={status} />
        </CardTitle>
        <CardDescription className="break-all">{url}</CardDescription>
      </CardHeader>
      <CardContent>
        {status === "connecting" && (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Connecting to demo Provider...
          </p>
        )}
        {status === "error" && (
          <p className="text-sm text-destructive" data-testid="provider-error">
            Connection failed: {errorMessage}. The playground will use built-in demo data instead.
          </p>
        )}
        {status === "connected" && services.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {services.length} service{services.length !== 1 ? "s" : ""} available
            </p>
            <div className="flex flex-wrap gap-2">
              {services.map((s) => (
                <Badge key={s.service_type} variant="secondary">
                  {s.service_type}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusIndicator({ status }: { readonly status: ConnectionStatus }) {
  switch (status) {
    case "connected":
      return (
        <CheckCircle
          className="h-4 w-4 text-green-500"
          data-testid="status-connected"
          aria-label="Connected"
        />
      );
    case "error":
      return (
        <XCircle
          className="h-4 w-4 text-destructive"
          data-testid="status-error"
          aria-label="Connection error"
        />
      );
    case "connecting":
      return (
        <Loader2
          className="h-4 w-4 animate-spin"
          data-testid="status-connecting"
          aria-label="Connecting"
        />
      );
    default:
      return null;
  }
}
