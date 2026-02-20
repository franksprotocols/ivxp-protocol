/**
 * Demo service handlers bridging the SDK's ServiceHandler interface
 * to the demo service implementations.
 *
 * The SDK calls handlers with a StoredOrder and expects back
 * `{ content: string | Uint8Array; content_type: string }`.
 * This module adapts our service implementations to that contract.
 *
 * Request input support: if the server passes a lookup callback via
 * HandlerContext, handlers can recover original request input by orderId
 * and generate richer deliverables (for example text transforms).
 * Without context, handlers fall back to a default description.
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

type TextTransform = "uppercase" | "lowercase" | "reverse";

interface HandlerContext {
  readonly getOrderInput?: (orderId: string) => unknown;
}

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

function applyTransform(text: string, transform?: TextTransform): string {
  if (!transform) return text;
  if (transform === "uppercase") return text.toUpperCase();
  if (transform === "lowercase") return text.toLowerCase();
  if (transform === "reverse") return text.split("").reverse().join("");
  return text;
}

function parseOrderInput(raw: unknown): { text: string; transform?: TextTransform } | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  if (typeof rec.text !== "string" || rec.text.trim().length === 0) {
    return null;
  }

  const transform =
    rec.transform === "uppercase" || rec.transform === "lowercase" || rec.transform === "reverse"
      ? rec.transform
      : undefined;

  return { text: rec.text, transform };
}

function createTextEchoHandler(context?: HandlerContext): ServiceHandler {
  return async (order) => {
    try {
      validateOrder(order);

      const requestInput = context?.getOrderInput?.(order.orderId);
      const parsedInput = parseOrderInput(requestInput);
      const description =
        parsedInput?.text ?? `Demo ${order.serviceType} service for order ${order.orderId}`;
      const transformed = applyTransform(description, parsedInput?.transform);
      const result = await executeTextEcho(order.orderId, description, transformed);

      return {
        content: result.content,
        content_type: result.contentType,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Text echo handler failed: ${message}`);
    }
  };
}

function createImageGenHandler(context?: HandlerContext): ServiceHandler {
  return async (order) => {
    try {
      validateOrder(order);

      const requestInput = context?.getOrderInput?.(order.orderId);
      const parsedInput =
        requestInput && typeof requestInput === "object"
          ? (requestInput as Record<string, unknown>)
          : null;
      const prompt =
        (parsedInput?.prompt && typeof parsedInput.prompt === "string"
          ? parsedInput.prompt
          : null) ??
        (parsedInput?.text && typeof parsedInput.text === "string" ? parsedInput.text : null);
      const description = prompt ?? `Demo ${order.serviceType} service for order ${order.orderId}`;
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
}

/**
 * Default text echo handler used by unit tests and baseline provider setup.
 */
export const textEchoHandler: ServiceHandler = createTextEchoHandler();

/**
 * Default image generation handler used by unit tests and baseline provider setup.
 */
export const imageGenHandler: ServiceHandler = createImageGenHandler();

/**
 * Build a Map of service type -> handler for all demo services.
 */
export function createServiceHandlers(context?: HandlerContext): Map<string, ServiceHandler> {
  return new Map<string, ServiceHandler>([
    ["text_echo", createTextEchoHandler(context)],
    ["image_gen", createImageGenHandler(context)],
  ]);
}
