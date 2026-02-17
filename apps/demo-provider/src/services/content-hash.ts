/**
 * Content hash utility for IVXP Demo Provider deliverables.
 *
 * Computes SHA-256 hashes for deliverable content to enable
 * client-side integrity verification. Uses Node.js crypto module.
 */

import { createHash } from "node:crypto";

/**
 * Compute the SHA-256 hash of the given content.
 *
 * @param content - String or binary content to hash
 * @returns Hex-encoded SHA-256 hash
 */
export function computeContentHash(content: string | Uint8Array): string {
  const hash = createHash("sha256");
  hash.update(content);
  return hash.digest("hex");
}
