/**
 * Demo service handler stubs.
 *
 * Provides simple handler implementations for the demo services.
 * Actual service logic will be implemented in Story 6.3.
 *
 * @see Story 6.3 for full service handler implementations
 */

import type { StoredOrder } from "@ivxp/protocol";

/**
 * Service handler function type (mirrors SDK's ServiceHandler).
 *
 * Called asynchronously after a delivery request is accepted.
 */
type ServiceHandler = (
  order: StoredOrder,
  params?: Record<string, unknown>,
) => Promise<{ content: string | Uint8Array; content_type: string }>;

/**
 * Text echo handler: returns the input description back as the deliverable.
 */
export const textEchoHandler: ServiceHandler = async (order) => {
  const echoText = `Echo: ${order.serviceType} order ${order.orderId} processed successfully.`;
  return {
    content: echoText,
    content_type: "text/plain",
  };
};

/**
 * Image generation handler stub: returns a placeholder SVG.
 */
export const imageGenHandler: ServiceHandler = async (order) => {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">',
    '  <rect width="256" height="256" fill="#6366f1"/>',
    '  <text x="128" y="128" text-anchor="middle" fill="white" font-size="14">',
    `    IVXP Demo: ${order.orderId}`,
    "  </text>",
    "</svg>",
  ].join("\n");

  return {
    content: svg,
    content_type: "image/svg+xml",
  };
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
