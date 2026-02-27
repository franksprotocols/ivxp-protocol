/**
 * Error conversion utilities for the LangGraph adapter.
 *
 * Converts IVXP-specific errors into plain Error instances suitable
 * for LangGraph error handling, preserving the original error as `cause`.
 */

import { IVXPError } from "@ivxp/sdk";

/**
 * Convert an unknown error into a LangGraph-compatible Error.
 *
 * - IVXPError → plain Error with formatted message and original as cause
 * - Error → returned as-is
 * - Other → wrapped in a new Error with stringified message
 */
export function toLangGraphError(err: unknown, operation: string): Error {
  if (err instanceof IVXPError) {
    const message = `[IVXP:${err.code}] ${operation} failed: ${err.message}`;
    const converted = new Error(message);
    converted.cause = err;
    return converted;
  }
  if (err instanceof Error) {
    return err;
  }
  return new Error(`[IVXP] ${operation} failed: ${String(err)}`);
}
