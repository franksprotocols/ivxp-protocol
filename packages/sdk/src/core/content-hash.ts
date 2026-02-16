/**
 * Content hashing utility for IVXP deliverables.
 *
 * Computes SHA-256 hashes of deliverable content for integrity verification.
 * Supports both string and Uint8Array (including Buffer) content types.
 *
 * Uses the Web Crypto API (available in Node.js 20+ and all modern browsers)
 * to avoid @types/node dependency.
 *
 * @see Story 3.17 - IVXPProvider Order Processing & Storage
 */

/**
 * Compute the SHA-256 hash of the given content.
 *
 * Returns a hex-encoded hash string. Supports both string and
 * Uint8Array/Buffer content types to accommodate various deliverable formats.
 *
 * Uses Node.js crypto module via dynamic import to avoid @types/node
 * dependency in type declarations.
 *
 * @param content - The content to hash (string or Uint8Array/Buffer)
 * @returns Hex-encoded SHA-256 hash string
 */
export async function computeContentHash(content: string | Uint8Array): Promise<string> {
  if (typeof content !== "string" && !(content instanceof Uint8Array)) {
    throw new Error(
      `Invalid content type: expected string or Uint8Array, received ${typeof content}`,
    );
  }

  const cryptoModuleName = "node:crypto";
  const crypto = (await import(/* @vite-ignore */ cryptoModuleName)) as {
    createHash: (algorithm: string) => {
      update: (data: string | Uint8Array) => unknown;
      digest: (encoding: string) => string;
    };
  };

  const hash = crypto.createHash("sha256");
  hash.update(content);
  return hash.digest("hex");
}
