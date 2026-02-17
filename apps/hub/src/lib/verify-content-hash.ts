/**
 * Content hash verification utility.
 *
 * Computes SHA-256 of deliverable content and compares it against
 * the claimed content_hash from the provider.
 */

export interface VerificationResult {
  readonly verified: boolean;
  readonly computedHash: string;
  readonly claimedHash: string;
}

/**
 * Compute SHA-256 hex digest of an ArrayBuffer.
 */
export async function computeSha256(data: ArrayBuffer): Promise<string> {
  // Wrap in Uint8Array to avoid ArrayBuffer realm mismatch in jsdom/CI environments.
  const hashBuffer = await crypto.subtle.digest("SHA-256", new Uint8Array(data));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verify content hash matches the claimed hash.
 * Supports both raw hex and "sha256:" prefixed formats.
 */
export async function verifyContentHash(
  content: ArrayBuffer,
  claimedHash: string,
): Promise<VerificationResult> {
  const computedHash = await computeSha256(content);

  // Normalize: strip "sha256:" prefix if present
  const normalizedClaimed = claimedHash.startsWith("sha256:") ? claimedHash.slice(7) : claimedHash;

  return {
    verified: computedHash === normalizedClaimed,
    computedHash: `sha256:${computedHash}`,
    claimedHash,
  };
}
