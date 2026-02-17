/**
 * Service registry for the IVXP Demo Provider.
 *
 * Maps service type identifiers to their handler functions and provides
 * a unified execution interface. Also re-exports all service types.
 */

import type { ServiceHandlerFn } from "./types.js";
import { executeTextEcho } from "./text-echo.js";
import { executeImageGen } from "./image-gen.js";

export type { ServiceResult, ServiceHandlerFn, ServiceHandler } from "./types.js";
export { computeContentHash } from "./content-hash.js";
export { executeTextEcho } from "./text-echo.js";
export { executeImageGen } from "./image-gen.js";

/**
 * Registry of all available demo service handlers.
 *
 * Maps service type strings to their execution functions.
 * Frozen to prevent runtime modifications -- new services require code changes.
 */
const SERVICE_HANDLERS: ReadonlyMap<string, ServiceHandlerFn> = Object.freeze(
  new Map([
    ["text_echo", executeTextEcho],
    ["image_gen", executeImageGen],
  ]),
) as ReadonlyMap<string, ServiceHandlerFn>;

/**
 * Look up a service handler by type.
 *
 * @param serviceType - The service type identifier
 * @returns The handler function, or undefined if not found
 */
export function getServiceHandler(serviceType: string): ServiceHandlerFn | undefined {
  return SERVICE_HANDLERS.get(serviceType);
}

/**
 * Get all registered service type identifiers.
 */
export function getRegisteredServiceTypes(): readonly string[] {
  return [...SERVICE_HANDLERS.keys()];
}
