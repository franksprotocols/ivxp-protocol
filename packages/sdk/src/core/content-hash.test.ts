/**
 * Content hashing utility tests.
 *
 * Tests SHA-256 content hashing for both string and Uint8Array/Buffer inputs.
 *
 * @see Story 3.17 - IVXPProvider Order Processing & Storage
 */

import { describe, expect, it } from "vitest";
import { createHash } from "crypto";
import { computeContentHash } from "./content-hash.js";

describe("computeContentHash", () => {
  it("should compute SHA-256 hash of a string", async () => {
    const content = "Hello, World!";
    const expected = createHash("sha256").update(content).digest("hex");

    const result = await computeContentHash(content);

    expect(result).toBe(expected);
  });

  it("should compute SHA-256 hash of a Buffer", async () => {
    const content = Buffer.from("Hello, World!");
    const expected = createHash("sha256").update(content).digest("hex");

    const result = await computeContentHash(content);

    expect(result).toBe(expected);
  });

  it("should return hex-encoded string", async () => {
    const result = await computeContentHash("test");

    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it("should produce different hashes for different content", async () => {
    const hash1 = await computeContentHash("content A");
    const hash2 = await computeContentHash("content B");

    expect(hash1).not.toBe(hash2);
  });

  it("should produce consistent hashes for the same content", async () => {
    const hash1 = await computeContentHash("same content");
    const hash2 = await computeContentHash("same content");

    expect(hash1).toBe(hash2);
  });

  it("should handle empty string", async () => {
    const expected = createHash("sha256").update("").digest("hex");
    const result = await computeContentHash("");

    expect(result).toBe(expected);
  });

  it("should handle empty Uint8Array", async () => {
    const expected = createHash("sha256").update(new Uint8Array(0)).digest("hex");
    const result = await computeContentHash(new Uint8Array(0));

    expect(result).toBe(expected);
  });

  it("should handle empty Buffer", async () => {
    const expected = createHash("sha256").update(Buffer.alloc(0)).digest("hex");
    const result = await computeContentHash(Buffer.alloc(0));

    expect(result).toBe(expected);
  });

  it("should reject invalid content type (number)", async () => {
    await expect(computeContentHash(42 as unknown as string)).rejects.toThrow(
      "Invalid content type",
    );
  });

  it("should reject invalid content type (null)", async () => {
    await expect(computeContentHash(null as unknown as string)).rejects.toThrow(
      "Invalid content type",
    );
  });

  it("should reject invalid content type (object)", async () => {
    await expect(computeContentHash({} as unknown as string)).rejects.toThrow(
      "Invalid content type",
    );
  });
});
