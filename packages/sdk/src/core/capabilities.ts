/**
 * IVXP Provider Capability Detection
 *
 * Utilities for checking whether a provider catalog declares specific
 * optional capabilities introduced in IVXP/3.0.
 */

import type { ServiceCatalogOutput } from "@ivxp/protocol";

/**
 * Known IVXP capability identifiers.
 * Clients should use these constants rather than raw strings.
 */
export const CAPABILITY_SSE = "sse" as const;

export type KnownCapability = typeof CAPABILITY_SSE;

/**
 * Check whether a provider catalog declares a specific capability.
 *
 * Unknown capability strings are silently ignored — this function
 * returns false for any string not present in the catalog's capabilities
 * array, including future capabilities not yet known to this SDK version.
 *
 * @example
 * ```typescript
 * const catalog = await client.getCatalog(providerUrl);
 * if (hasCapability(catalog, CAPABILITY_SSE)) {
 *   // Use SSE streaming path
 * }
 * ```
 */
export function hasCapability(catalog: ServiceCatalogOutput, capability: string): boolean {
  return catalog.capabilities?.includes(capability) ?? false;
}
