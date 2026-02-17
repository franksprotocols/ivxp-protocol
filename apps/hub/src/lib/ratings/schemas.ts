import { z } from "zod";

/** Maximum length for review text to prevent abuse */
const MAX_REVIEW_TEXT_LENGTH = 1000;

/**
 * Order ID format: alphanumeric with hyphens and underscores.
 * Prevents injection of special characters.
 */
const ORDER_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/;

/**
 * Schema for the POST /api/ratings request body.
 * Validates star range (1-5), optional review text, signature format,
 * and client-provided timestamp for replay attack prevention.
 */
export const submitRatingBodySchema = z.object({
  order_id: z
    .string()
    .min(1, "order_id is required")
    .max(100, "order_id must be <= 100 characters")
    .regex(ORDER_ID_PATTERN, "order_id must be alphanumeric (hyphens and underscores allowed)"),
  stars: z
    .number()
    .int("stars must be an integer")
    .min(1, "stars must be >= 1")
    .max(5, "stars must be <= 5"),
  review_text: z
    .string()
    .max(MAX_REVIEW_TEXT_LENGTH, `review_text must be <= ${MAX_REVIEW_TEXT_LENGTH} characters`)
    .optional(),
  signature: z
    .string()
    .regex(/^0x[a-fA-F0-9]{130}$/, "Invalid signature format (must be 0x + 130 hex chars)"),
  timestamp: z.number().int("timestamp must be an integer").positive("timestamp must be positive"),
});

export type SubmitRatingBodyInput = z.input<typeof submitRatingBodySchema>;
export type SubmitRatingBodyParsed = z.output<typeof submitRatingBodySchema>;
