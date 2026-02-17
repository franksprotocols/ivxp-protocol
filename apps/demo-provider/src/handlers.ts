/**
 * Demo service handlers bridging the SDK's ServiceHandler interface
 * to the demo service implementations.
 *
 * The SDK calls handlers with a StoredOrder and expects back
 * `{ content: string | Uint8Array; content_type: string }`.
 * This module adapts our service implementations to that contract.
 *
 * LIMITATION: The original service request description is not persisted
 * on StoredOrder by the SDK. Handlers use a fallback description based
 * on the order metadata. For production use, consider extending the
 * order storage schema to include the original description field.
 *
 * RATE LIMITING: Service execution rate limiting is handled at the HTTP
 * layer by Express middleware (see server.ts). The default is 100 requests
 * per minute per IP address. Service handlers themselves do not implement
 * additional rate limiting, as the SDK processes orders asynchronously
 * after payment verification. For production use with resource-intensive
 * services, consider adding per-service execution limits or queue-based
 * throttling in the handler layer.
 *
 * @see services/ for the actual service logic
 * @see Story 6.3 for full service handler implementations
 */

import type { StoredOrder } from "@ivxp/protocol";
import { executeTextEcho } from "./services/text-echo.js";
import { executeImageGen } from "./services/image-gen.js";

/**
 * Service handler function type (mirrors SDK's ServiceHandler).
 *
 * Called asynchronously after a delivery request is accepted.
 */
type ServiceHandler = (
  order: StoredOrder,
  params?: Record<string, unknown>,
) => Promise<{ content: string | Uint8Array; content_type: string }>;

/** Regex for valid IVXP order IDs: ivxp-{uuid-v4}. */
const ORDER_ID_REGEX =
  /^ivxp-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate that the order has required fields and correct format.
 *
 * @throws Error if validation fails
 */
function validateOrder(order: StoredOrder): void {
  if (!order.orderId || typeof order.orderId !== "string") {
    throw new Error("Invalid order: orderId is required and must be a string");
  }

  if (!ORDER_ID_REGEX.test(order.orderId)) {
    throw new Error(
      `Invalid order: orderId must match format ivxp-{uuid-v4}, got: ${order.orderId}`,
    );
  }

  if (!order.serviceType || typeof order.serviceType !== "string") {
    throw new Error("Invalid order: serviceType is required and must be a string");
  }

  if (order.status !== "processing") {
    throw new Error(`Invalid order: expected status "processing", got: ${order.status}`);
  }
}

/**
 * Text echo handler: delegates to the text-echo service implementation.
 *
 * LIMITATION: Uses the order's serviceType as the echo text since the original
 * description is not persisted on StoredOrder. See module-level documentation.
 */
export const textEchoHandler: ServiceHandler = async (order) => {
  try {
    validateOrder(order);

    // Fallback description since original is not available on StoredOrder
    const description = `Demo ${order.serviceType} service for order ${order.orderId}`;
    const result = await executeTextEcho(order.orderId, description);

    return {
      content: result.content,
      content_type: result.contentType,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Text echo handler failed: ${message}`);
  }
};

/**
 * Image generation handler: delegates to the image-gen service implementation.
 *
 * LIMITATION: Uses the order's serviceType as the prompt since the original
 * description is not persisted on StoredOrder. See module-level documentation.
 */
export const imageGenHandler: ServiceHandler = async (order) => {
  try {
    validateOrder(order);

    // Fallback description since original is not available on StoredOrder
    const description = `Demo ${order.serviceType} service for order ${order.orderId}`;
    const result = await executeImageGen(order.orderId, description);

    return {
      content: result.content,
      content_type: result.contentType,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Image generation handler failed: ${message}`);
  }
};

/**
 * Build a Map of service type -> handler for all demo services.
 */
export function createServiceHandlers(): Map<string, ServiceHandler> {
  return new Map<string, ServiceHandler>([
    ["text_echo", textEchoHandler],
    ["image_gen", imageGenHandler],
  ]);
}
