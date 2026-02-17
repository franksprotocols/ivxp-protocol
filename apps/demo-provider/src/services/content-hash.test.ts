/**
 * Unit tests for the content hash utility.
 *
 * Validates:
 * - SHA-256 hash computation for string content
 * - SHA-256 hash computation for Uint8Array content
 * - Deterministic output (same input -> same hash)
 * - Different inputs produce different hashes
 */

import { describe, expect, it } from "vitest";
import { computeContentHash } from "./content-hash.js";

describe("computeContentHash", () => {
  it("should compute a SHA-256 hex hash for string content", () => {
    const hash = computeContentHash("hello world");
    expect(hash).toBeTypeOf("string");
    expect(hash).toHaveLength(64); // SHA-256 = 64 hex chars
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("should compute a SHA-256 hex hash for Uint8Array content", () => {
    const content = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const hash = computeContentHash(content);
    expect(hash).toBeTypeOf("string");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("should be deterministic (same input -> same hash)", () => {
    const input = "deterministic test input";
    const hash1 = computeContentHash(input);
    const hash2 = computeContentHash(input);
    expect(hash1).toBe(hash2);
  });

  it("should produce different hashes for different inputs", () => {
    const hash1 = computeContentHash("input A");
    const hash2 = computeContentHash("input B");
    expect(hash1).not.toBe(hash2);
  });

  it("should handle empty string", () => {
    const hash = computeContentHash("");
    expect(hash).toHaveLength(64);
    // SHA-256 of empty string is well-known
    expect(hash).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });
});
