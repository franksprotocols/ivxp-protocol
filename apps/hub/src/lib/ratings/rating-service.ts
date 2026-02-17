import { randomUUID } from "node:crypto";
import { recoverMessageAddress } from "viem";
import type { RatingWire, RatingErrorCode, Stars } from "./types";
import { addRating, loadRatings, isDuplicateRating } from "./rating-storage";

/** Timestamp tolerance: +/- 5 minutes */
const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

/** Sanitize review text to prevent XSS */
export function sanitizeReviewText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
    .replace(/`/g, "&#96;");
}

/** Build the canonical rating message that the client must sign */
export function buildRatingMessage(params: {
  readonly orderId: string;
  readonly stars: Stars;
  readonly reviewText?: string;
  readonly timestamp: number;
}): string {
  const lines = [
    "IVXP Rating Submission",
    `Order: ${params.orderId}`,
    `Stars: ${params.stars}`,
    `Timestamp: ${params.timestamp}`,
  ];
  if (params.reviewText) {
    lines.push(`Review: ${params.reviewText}`);
  }
  return lines.join("\n");
}

/** Generate a unique rating ID */
export function generateRatingId(): string {
  return `rating-${randomUUID()}`;
}

/** Result type for submitRating */
export type SubmitRatingResult =
  | { readonly success: true; readonly ratingId: string }
  | {
      readonly success: false;
      readonly code: RatingErrorCode;
      readonly message: string;
    };

/**
 * Core business logic for submitting a rating.
 *
 * Validates:
 * 1. Client timestamp is within +/- 5 minutes (replay prevention)
 * 2. Order exists and is in "delivered" status
 * 3. Signature matches the client_address from the order
 * 4. No duplicate rating for the same order + client
 */
export async function submitRating(
  params: {
    readonly orderId: string;
    readonly stars: Stars;
    readonly reviewText?: string;
    readonly signature: `0x${string}`;
    readonly timestamp: number;
  },
  getOrder: (orderId: string) =>
    | {
        readonly orderId: string;
        readonly status: string;
        readonly clientAddress?: string;
        readonly providerAddress: string;
        readonly serviceType: string;
      }
    | undefined,
): Promise<SubmitRatingResult> {
  // 1. Validate timestamp to prevent replay attacks
  const now = Date.now();
  const timeDiff = Math.abs(now - params.timestamp);
  if (timeDiff > TIMESTAMP_TOLERANCE_MS) {
    return {
      success: false,
      code: "TIMESTAMP_EXPIRED",
      message: `Timestamp is outside the allowed window (${Math.round(timeDiff / 1000)}s drift, max 300s).`,
    };
  }

  // 2. Look up the order
  const order = getOrder(params.orderId);
  if (!order) {
    return {
      success: false,
      code: "ORDER_NOT_FOUND",
      message: "Order not found.",
    };
  }

  // 3. Verify order is delivered
  if (order.status !== "delivered") {
    return {
      success: false,
      code: "ORDER_NOT_DELIVERED",
      message: `Order is not delivered (current status: ${order.status}).`,
    };
  }

  // 4. Verify signature using the client-provided timestamp
  const message = buildRatingMessage({
    orderId: params.orderId,
    stars: params.stars,
    reviewText: params.reviewText,
    timestamp: params.timestamp,
  });

  let recoveredAddress: string;
  try {
    recoveredAddress = await recoverMessageAddress({
      message,
      signature: params.signature,
    });
  } catch {
    return {
      success: false,
      code: "INVALID_SIGNATURE",
      message: "Failed to recover address from signature.",
    };
  }

  // 5. Verify signer matches order's client_address
  if (
    !order.clientAddress ||
    recoveredAddress.toLowerCase() !== order.clientAddress.toLowerCase()
  ) {
    return {
      success: false,
      code: "INVALID_SIGNATURE",
      message: "Signature does not match the order's client address.",
    };
  }

  // 6. Check for duplicate rating
  const existingRatings = loadRatings();
  if (isDuplicateRating(existingRatings, params.orderId, order.clientAddress)) {
    return {
      success: false,
      code: "DUPLICATE_RATING",
      message: "A rating for this order has already been submitted.",
    };
  }

  // 7. Build and store the rating
  const ratingId = generateRatingId();
  const sanitizedReview = params.reviewText ? sanitizeReviewText(params.reviewText) : undefined;

  const rating: RatingWire = {
    rating_id: ratingId,
    order_id: params.orderId,
    provider_address: order.providerAddress,
    service_type: order.serviceType,
    client_address: order.clientAddress,
    stars: params.stars as Stars,
    review_text: sanitizedReview,
    signature: params.signature,
    created_at: params.timestamp,
  };

  await addRating(rating);

  return { success: true, ratingId };
}
