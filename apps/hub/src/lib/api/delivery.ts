/**
 * Delivery API client for requesting service delivery from a provider.
 *
 * Sends the payment proof and identity signature to the provider's
 * delivery endpoint. Used by the Hub after payment + EIP-191 signing.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

/** Regex for 0x-prefixed hex strings (tx hashes, signatures, addresses). */
const HEX_PREFIXED_REGEX = /^0x[0-9a-fA-F]+$/;

const VALID_NETWORKS = ["base", "base-sepolia"] as const;
export type ValidNetwork = (typeof VALID_NETWORKS)[number];

const DeliveryRequestPayloadSchema = z.object({
  order_id: z
    .string()
    .min(1, "order_id must not be empty")
    .max(256, "order_id exceeds maximum length"),
  payment: z.object({
    tx_hash: z.string().regex(HEX_PREFIXED_REGEX, "tx_hash must be a 0x-prefixed hex string"),
    network: z.enum(VALID_NETWORKS, {
      message: `network must be one of: ${VALID_NETWORKS.join(", ")}`,
    }),
  }),
  signature: z.object({
    message: z.string().min(1, "signature message must not be empty"),
    sig: z.string().regex(HEX_PREFIXED_REGEX, "sig must be a 0x-prefixed hex string"),
    signer: z
      .string()
      .regex(/^0x[0-9a-fA-F]{40}$/, "signer must be a valid 0x-prefixed 40-character hex address"),
  }),
});

const DeliveryResponseSchema = z.object({
  order_id: z.string(),
  status: z.string(),
});

// ---------------------------------------------------------------------------
// Types (inferred from schemas)
// ---------------------------------------------------------------------------

export type DeliveryRequestPayload = z.input<typeof DeliveryRequestPayloadSchema>;
export type DeliveryResponse = z.output<typeof DeliveryResponseSchema>;

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

export const DELIVERY_ERROR_CODES = {
  VALIDATION_FAILED: "VALIDATION_FAILED",
  NETWORK_ERROR: "NETWORK_ERROR",
  SERVER_ERROR: "SERVER_ERROR",
  INVALID_RESPONSE: "INVALID_RESPONSE",
} as const;

export type DeliveryErrorCode = (typeof DELIVERY_ERROR_CODES)[keyof typeof DELIVERY_ERROR_CODES];

export class DeliveryError extends Error {
  readonly code: DeliveryErrorCode;
  constructor(message: string, code: DeliveryErrorCode) {
    super(message);
    this.name = "DeliveryError";
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default provider base URL. In production, this comes from the service registry. */
const DEFAULT_PROVIDER_URL = process.env.NEXT_PUBLIC_PROVIDER_URL ?? "http://localhost:8080";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map HTTP status codes to user-friendly error messages.
 * Avoids leaking raw status codes or server internals to the UI.
 */
function sanitizeHttpError(status: number): string {
  if (status === 400) return "Invalid delivery request. Please check your data and try again.";
  if (status === 401 || status === 403)
    return "Authorization failed. Please reconnect your wallet.";
  if (status === 404) return "Order not found. It may have expired or been cancelled.";
  if (status >= 500) return "The provider is temporarily unavailable. Please try again later.";
  return "Delivery request failed. Please try again.";
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/**
 * Request delivery from a provider after payment and identity signing.
 *
 * Validates the payload with Zod before sending. Posts the wire-format
 * delivery request to POST /ivxp/orders/{orderId}/delivery.
 *
 * @param payload - The delivery request payload with payment proof and signature
 * @param providerUrl - Optional provider base URL override
 * @returns The validated delivery response from the provider
 * @throws DeliveryError with code VALIDATION_FAILED if payload is invalid
 * @throws DeliveryError with code NETWORK_ERROR if fetch fails
 * @throws DeliveryError with code SERVER_ERROR if provider returns HTTP error
 * @throws DeliveryError with code INVALID_RESPONSE if response fails validation
 */
export async function requestDelivery(
  payload: DeliveryRequestPayload,
  providerUrl: string = DEFAULT_PROVIDER_URL,
): Promise<DeliveryResponse> {
  // Validate payload before sending
  const parseResult = DeliveryRequestPayloadSchema.safeParse(payload);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0]?.message ?? "Invalid payload";
    throw new DeliveryError(firstIssue, DELIVERY_ERROR_CODES.VALIDATION_FAILED);
  }

  const validated = parseResult.data;
  const url = `${providerUrl}/ivxp/orders/${encodeURIComponent(validated.order_id)}/delivery`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validated),
    });
  } catch (err) {
    console.error("Delivery fetch failed:", err);
    throw new DeliveryError(
      "Unable to reach the provider. Please check your connection and try again.",
      DELIVERY_ERROR_CODES.NETWORK_ERROR,
    );
  }

  if (!response.ok) {
    throw new DeliveryError(sanitizeHttpError(response.status), DELIVERY_ERROR_CODES.SERVER_ERROR);
  }

  let rawData: unknown;
  try {
    rawData = await response.json();
  } catch {
    throw new DeliveryError(
      "Received an invalid response from the provider.",
      DELIVERY_ERROR_CODES.INVALID_RESPONSE,
    );
  }

  const responseResult = DeliveryResponseSchema.safeParse(rawData);
  if (!responseResult.success) {
    throw new DeliveryError(
      "Received an invalid response from the provider.",
      DELIVERY_ERROR_CODES.INVALID_RESPONSE,
    );
  }

  return responseResult.data;
}
