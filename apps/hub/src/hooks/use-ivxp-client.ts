import { useMemo } from "react";
import { z } from "zod";
import {
  requestDelivery as postDeliveryRequest,
  DeliveryError,
  DELIVERY_ERROR_CODES,
  type DeliveryRequestPayload,
  type DeliveryResponse,
} from "@/lib/api/delivery";

const DEFAULT_PROVIDER_URL = process.env.NEXT_PUBLIC_PROVIDER_URL ?? "http://localhost:3001";
const FALLBACK_SIGNER = "0x0000000000000000000000000000000000000000";

export interface DeliverableResponse {
  readonly content: ArrayBuffer;
  readonly contentType: string;
  readonly contentHash: string;
  readonly fileName?: string;
}

export interface QuoteRequestParams {
  readonly service_type: string;
  readonly input: Record<string, unknown>;
  readonly client_address?: string;
  readonly budget_usdc?: string;
}

export interface QuoteResponse {
  readonly order_id: string;
  readonly price_usdc: string;
  readonly payment_address: string;
  readonly expires_at: string;
  readonly service_type: string;
}

export interface OrderStatusResponse {
  readonly order_id: string;
  readonly status: string;
}

export interface IVXPClientError extends Error {
  code: string;
  recoverable: boolean;
}

export interface IVXPClient {
  on(event: string, handler: (payload: unknown) => void): void;
  off(event: string, handler: (payload: unknown) => void): void;
  emit(event: string, payload: unknown): void;
  requestQuote(providerUrl: string, params: QuoteRequestParams): Promise<QuoteResponse>;
  requestDelivery(providerUrl: string, payload: DeliveryRequestPayload): Promise<DeliveryResponse>;
  getOrderStatus(providerUrl: string, orderId: string): Promise<OrderStatusResponse>;
  downloadDeliverable(providerUrl: string, orderId: string): Promise<DeliverableResponse>;
}

const FlatQuoteResponseSchema = z.object({
  order_id: z.string().min(1),
  price_usdc: z.union([z.string().min(1), z.number().nonnegative()]),
  payment_address: z.string().min(1),
  expires_at: z.string().min(1).optional(),
  estimated_delivery: z.string().min(1).optional(),
  service_type: z.string().min(1).optional(),
});

const ProtocolQuoteResponseSchema = z.object({
  protocol: z.string().min(1),
  message_type: z.literal("service_quote"),
  order_id: z.string().min(1),
  quote: z.object({
    price_usdc: z.number().nonnegative(),
    estimated_delivery: z.string().min(1),
    payment_address: z.string().min(1),
  }),
});

const OrderStatusResponseSchema = z.object({
  order_id: z.string().min(1),
  status: z.string().min(1),
});

const DownloadResponseSchema = z.object({
  content: z.unknown(),
  content_type: z.string().optional(),
  contentType: z.string().optional(),
  content_hash: z.string().optional(),
  contentHash: z.string().optional(),
  file_name: z.string().optional(),
  fileName: z.string().optional(),
});

function normalizeProviderUrl(providerUrl?: string): string {
  const value = providerUrl?.trim();
  if (!value) return DEFAULT_PROVIDER_URL;
  return value.replace(/\/+$/, "");
}

function createClientError(message: string, code: string, recoverable: boolean): IVXPClientError {
  const error = new Error(message) as IVXPClientError;
  error.code = code;
  error.recoverable = recoverable;
  return error;
}

function decodeBase64Value(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return bytes.buffer;
}

function decodeDeliverableContent(raw: unknown, contentType: string): ArrayBuffer {
  if (raw instanceof ArrayBuffer) {
    return raw;
  }

  if (raw instanceof Uint8Array) {
    const copy = new Uint8Array(raw.byteLength);
    copy.set(raw);
    return copy.buffer;
  }

  if (Array.isArray(raw)) {
    return Uint8Array.from(raw).buffer;
  }

  if (typeof raw === "string") {
    const base64Match = raw.match(/^data:.*;base64,(.*)$/);
    if (base64Match?.[1]) {
      return decodeBase64Value(base64Match[1]);
    }

    const trimmed = raw.trim();
    const isTextLike =
      contentType.startsWith("text/") ||
      contentType === "application/json" ||
      contentType === "application/xml";
    const looksLikeRawBase64 =
      !isTextLike &&
      /^[A-Za-z0-9+/]+={0,2}$/.test(trimmed) &&
      trimmed.length > 0 &&
      trimmed.length % 4 === 0;

    if (looksLikeRawBase64) {
      try {
        return decodeBase64Value(trimmed);
      } catch {
        throw createClientError("Invalid deliverable content format.", "INVALID_RESPONSE", false);
      }
    }

    return new TextEncoder().encode(raw).buffer;
  }

  throw createClientError("Invalid deliverable content format.", "INVALID_RESPONSE", false);
}

function mapHttpError(status: number): IVXPClientError {
  if (status === 400) {
    return createClientError("Request payload is invalid.", "INVALID_REQUEST", false);
  }
  if (status === 401 || status === 403) {
    return createClientError("Authorization failed for provider request.", "UNAUTHORIZED", false);
  }
  if (status === 404) {
    return createClientError("Order not found on provider.", "ORDER_NOT_FOUND", true);
  }
  if (status >= 500) {
    return createClientError("Provider is temporarily unavailable.", "PROVIDER_UNAVAILABLE", true);
  }
  return createClientError("Provider request failed.", "REQUEST_FAILED", true);
}

function normalizePriceUsdc(value: string | number): string {
  return typeof value === "number" ? value.toString() : value;
}

function parseQuoteResponse(raw: unknown, requestedServiceType: string): QuoteResponse | null {
  const flat = FlatQuoteResponseSchema.safeParse(raw);
  if (flat.success) {
    const expiresAt = flat.data.expires_at ?? flat.data.estimated_delivery;
    if (!expiresAt) {
      return null;
    }
    return {
      order_id: flat.data.order_id,
      price_usdc: normalizePriceUsdc(flat.data.price_usdc),
      payment_address: flat.data.payment_address,
      expires_at: expiresAt,
      service_type: flat.data.service_type ?? requestedServiceType,
    };
  }

  const protocol = ProtocolQuoteResponseSchema.safeParse(raw);
  if (protocol.success) {
    return {
      order_id: protocol.data.order_id,
      price_usdc: protocol.data.quote.price_usdc.toString(),
      payment_address: protocol.data.quote.payment_address,
      expires_at: protocol.data.quote.estimated_delivery,
      service_type: requestedServiceType,
    };
  }

  return null;
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw createClientError("Received invalid JSON from provider.", "INVALID_RESPONSE", false);
  }
}

function mapDeliveryTransportError(error: unknown): IVXPClientError {
  if (error instanceof DeliveryError) {
    if (error.code === DELIVERY_ERROR_CODES.VALIDATION_FAILED) {
      return createClientError(error.message, "INVALID_REQUEST", false);
    }
    if (error.code === DELIVERY_ERROR_CODES.NETWORK_ERROR) {
      return createClientError(error.message, "NETWORK_ERROR", true);
    }
    if (error.code === DELIVERY_ERROR_CODES.INVALID_RESPONSE) {
      return createClientError(error.message, "INVALID_RESPONSE", false);
    }
    if (error.code === DELIVERY_ERROR_CODES.SERVER_ERROR && error.status) {
      return mapHttpError(error.status);
    }
  }

  if (error instanceof Error) {
    return createClientError(error.message, "REQUEST_FAILED", true);
  }

  return createClientError("Provider request failed.", "REQUEST_FAILED", true);
}

function shouldFallbackToLegacyDelivery(error: unknown): boolean {
  return (
    error instanceof DeliveryError &&
    error.code === DELIVERY_ERROR_CODES.SERVER_ERROR &&
    error.status === 404
  );
}

async function fetchOrderStatus(
  providerUrl: string,
  orderId: string,
  endpointPath: string,
): Promise<OrderStatusResponse> {
  const response = await fetch(`${providerUrl}${endpointPath}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw mapHttpError(response.status);
  }

  const payload = await safeJson(response);
  const parsed = OrderStatusResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw createClientError(
      "Provider returned invalid order status payload.",
      "INVALID_RESPONSE",
      false,
    );
  }
  return parsed.data;
}

class HubIVXPClient implements IVXPClient {
  private readonly handlers = new Map<string, Set<(payload: unknown) => void>>();

  on(event: string, handler: (payload: unknown) => void): void {
    const set = this.handlers.get(event) ?? new Set<(payload: unknown) => void>();
    set.add(handler);
    this.handlers.set(event, set);
  }

  off(event: string, handler: (payload: unknown) => void): void {
    this.handlers.get(event)?.delete(handler);
  }

  emit(event: string, payload: unknown): void {
    this.handlers.get(event)?.forEach((handler) => handler(payload));
  }

  async requestQuote(providerUrl: string, params: QuoteRequestParams): Promise<QuoteResponse> {
    const normalizedProviderUrl = normalizeProviderUrl(providerUrl);
    const budgetUsdc = Number(params.budget_usdc ?? "1");
    const budget = Number.isFinite(budgetUsdc) && budgetUsdc > 0 ? budgetUsdc : 1;

    const payload = {
      protocol: "IVXP/1.0",
      message_type: "service_request",
      timestamp: new Date().toISOString(),
      client_agent: {
        name: "ivxp-hub",
        wallet_address: params.client_address ?? FALLBACK_SIGNER,
      },
      service_request: {
        type: params.service_type,
        description: JSON.stringify(params.input),
        budget_usdc: budget,
      },
    };

    let response: Response;
    try {
      response = await fetch(`${normalizedProviderUrl}/ivxp/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch {
      throw createClientError("Unable to reach provider endpoint.", "NETWORK_ERROR", true);
    }

    if (!response.ok) {
      throw mapHttpError(response.status);
    }

    const raw = await safeJson(response);
    const parsed = parseQuoteResponse(raw, params.service_type);
    if (!parsed) {
      throw createClientError(
        "Provider returned invalid quote payload.",
        "INVALID_RESPONSE",
        false,
      );
    }
    return parsed;
  }

  async requestDelivery(
    providerUrl: string,
    payload: DeliveryRequestPayload,
  ): Promise<DeliveryResponse> {
    const normalizedProviderUrl = normalizeProviderUrl(providerUrl);

    try {
      return await postDeliveryRequest(payload, normalizedProviderUrl);
    } catch (error) {
      if (!shouldFallbackToLegacyDelivery(error)) {
        throw mapDeliveryTransportError(error);
      }

      const fallbackPayload = {
        protocol: "IVXP/1.0",
        message_type: "delivery_request",
        timestamp: new Date().toISOString(),
        order_id: payload.order_id,
        payment_proof: {
          tx_hash: payload.payment.tx_hash,
          from_address: payload.signature.signer,
          network: payload.payment.network === "base" ? "base-mainnet" : "base-sepolia",
        },
        signature: payload.signature.sig,
        signed_message: payload.signature.message,
      };

      let response: Response;
      try {
        response = await fetch(`${normalizedProviderUrl}/ivxp/deliver`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(fallbackPayload),
        });
      } catch {
        throw createClientError("Unable to reach provider endpoint.", "NETWORK_ERROR", true);
      }

      if (!response.ok) {
        throw mapHttpError(response.status);
      }

      const raw = await safeJson(response);
      const parsed = z
        .object({
          order_id: z.string().min(1),
          status: z.string().min(1),
        })
        .safeParse(raw);

      if (!parsed.success) {
        throw createClientError(
          "Provider returned invalid delivery payload.",
          "INVALID_RESPONSE",
          false,
        );
      }

      return parsed.data;
    }
  }

  async getOrderStatus(providerUrl: string, orderId: string): Promise<OrderStatusResponse> {
    const normalizedProviderUrl = normalizeProviderUrl(providerUrl);
    const encodedOrderId = encodeURIComponent(orderId);

    try {
      return await fetchOrderStatus(
        normalizedProviderUrl,
        orderId,
        `/ivxp/orders/${encodedOrderId}`,
      );
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ORDER_NOT_FOUND")) {
        throw error;
      }
      return fetchOrderStatus(normalizedProviderUrl, orderId, `/ivxp/status/${encodedOrderId}`);
    }
  }

  async downloadDeliverable(providerUrl: string, orderId: string): Promise<DeliverableResponse> {
    const normalizedProviderUrl = normalizeProviderUrl(providerUrl);
    const encodedOrderId = encodeURIComponent(orderId);

    const fetchDownload = async (endpointPath: string): Promise<DeliverableResponse> => {
      const response = await fetch(`${normalizedProviderUrl}${endpointPath}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw mapHttpError(response.status);
      }

      const raw = await safeJson(response);
      const parsed = DownloadResponseSchema.safeParse(raw);
      if (!parsed.success) {
        throw createClientError(
          "Provider returned invalid deliverable payload.",
          "INVALID_RESPONSE",
          false,
        );
      }

      const data = parsed.data;
      const contentType = data.content_type ?? data.contentType ?? "application/octet-stream";
      const content = decodeDeliverableContent(data.content, contentType);
      const contentHash = data.content_hash ?? data.contentHash;

      if (!contentHash) {
        throw createClientError("Provider deliverable hash is missing.", "INVALID_RESPONSE", false);
      }

      return {
        content,
        contentType,
        contentHash,
        fileName: data.file_name ?? data.fileName,
      };
    };

    try {
      return await fetchDownload(`/ivxp/orders/${encodedOrderId}/deliverable`);
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ORDER_NOT_FOUND")) {
        throw error;
      }
      return fetchDownload(`/ivxp/download/${encodedOrderId}`);
    }
  }
}

const sharedClient = new HubIVXPClient();

export function useIVXPClient(): IVXPClient {
  return useMemo(() => sharedClient, []);
}
