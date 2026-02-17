/**
 * Demo service catalog definition.
 *
 * Defines the services offered by the demo provider with pricing
 * and metadata. Uses ServiceDefinition from @ivxp/protocol.
 */

import type { ServiceDefinition } from "@ivxp/protocol";

/**
 * Demo services offered by this provider.
 *
 * - text_echo: Simple echo service for testing (low cost, fast)
 * - image_gen: Placeholder image generation (higher cost, slower)
 */
export const DEMO_SERVICES: readonly ServiceDefinition[] = [
  {
    type: "text_echo",
    base_price_usdc: 0.1,
    estimated_delivery_hours: 0.01,
  },
  {
    type: "image_gen",
    base_price_usdc: 1.5,
    estimated_delivery_hours: 0.05,
  },
] as const;
