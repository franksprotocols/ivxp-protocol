/**
 * Text Echo service handler for the IVXP Demo Provider.
 *
 * Echoes back the client's input text with a timestamp and order metadata.
 * Demonstrates the simplest possible IVXP service implementation.
 *
 * Input: The order description text from the service request.
 * Output: JSON string containing the echoed text, timestamp, and order ID.
 */

import type { ServiceResult } from "./types.js";
import { computeContentHash } from "./content-hash.js";

/** Maximum allowed description length for text echo. */
const MAX_DESCRIPTION_LENGTH = 10_000;

/** Regex for valid IVXP order IDs: ivxp-{uuid-v4}. */
const ORDER_ID_REGEX =
  /^ivxp-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Execute the text_echo service.
 *
 * @param orderId - The unique order identifier
 * @param description - The text to echo back
 * @returns ServiceResult with echoed text as JSON
 * @throws Error if orderId format is invalid
 * @throws Error if description is empty or exceeds max length
 */
export async function executeTextEcho(
  orderId: string,
  description: string,
): Promise<ServiceResult> {
  // Validate orderId format
  if (!orderId || typeof orderId !== "string") {
    throw new Error("Invalid input: orderId is required and must be a string");
  }

  if (!ORDER_ID_REGEX.test(orderId)) {
    throw new Error(`Invalid input: orderId must match format ivxp-{uuid-v4}, got: ${orderId}`);
  }

  // Validate description
  if (!description || typeof description !== "string") {
    throw new Error("Invalid input: description is required and must be a string");
  }

  if (description.trim().length === 0) {
    throw new Error("Invalid input: description cannot be empty or whitespace-only");
  }

  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error(
      `Invalid input: description exceeds maximum length of ${MAX_DESCRIPTION_LENGTH} characters`,
    );
  }

  const result = {
    service_type: "text_echo",
    original_text: description,
    echoed_text: description,
    timestamp: new Date().toISOString(),
    order_id: orderId,
  };

  const content = JSON.stringify(result);
  const contentHash = computeContentHash(content);

  return {
    content,
    contentType: "application/json",
    contentHash,
    metadata: result,
  };
}
