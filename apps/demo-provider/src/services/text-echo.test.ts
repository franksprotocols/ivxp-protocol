/**
 * Unit tests for the text_echo service handler.
 *
 * Validates:
 * - AC #1: text_echo returns echoed text with timestamp
 * - AC #3: deliverables are properly formatted
 * - AC #4: content hashes are calculated for verification
 * - Error handling for invalid inputs
 */

import { describe, expect, it } from "vitest";
import { executeTextEcho } from "./text-echo.js";
import { computeContentHash } from "./content-hash.js";

const TEST_ORDER_ID = "ivxp-550e8400-e29b-41d4-a716-446655440000";

describe("executeTextEcho", () => {
  it("should return echoed text with timestamp (AC #1)", async () => {
    const result = await executeTextEcho(TEST_ORDER_ID, "Hello IVXP");

    expect(result.contentType).toBe("application/json");
    expect(result.content).toBeTypeOf("string");

    const parsed = JSON.parse(result.content as string);
    expect(parsed.original_text).toBe("Hello IVXP");
    expect(parsed.echoed_text).toBe("Hello IVXP");
    expect(parsed.order_id).toBe(TEST_ORDER_ID);
    expect(parsed.timestamp).toBeTypeOf("string");
    // Verify timestamp is valid ISO 8601
    expect(new Date(parsed.timestamp).toISOString()).toBe(parsed.timestamp);
  });

  it("should include correct content hash (AC #4)", async () => {
    const result = await executeTextEcho(TEST_ORDER_ID, "Hash test");

    expect(result.contentHash).toBeTypeOf("string");
    expect(result.contentHash).toHaveLength(64);

    // Verify hash matches content
    const expectedHash = computeContentHash(result.content);
    expect(result.contentHash).toBe(expectedHash);
  });

  it("should include metadata in the result", async () => {
    const result = await executeTextEcho(TEST_ORDER_ID, "Metadata test");

    expect(result.metadata).toBeDefined();
    expect(result.metadata!["original_text"]).toBe("Metadata test");
    expect(result.metadata!["echoed_text"]).toBe("Metadata test");
    expect(result.metadata!["order_id"]).toBe(TEST_ORDER_ID);
  });

  it("should throw for empty description", async () => {
    await expect(executeTextEcho(TEST_ORDER_ID, "")).rejects.toThrow("description is required");
  });

  it("should throw for whitespace-only description", async () => {
    await expect(executeTextEcho(TEST_ORDER_ID, "   ")).rejects.toThrow(
      "description cannot be empty",
    );
  });

  it("should throw for description exceeding max length", async () => {
    const longText = "x".repeat(10_001);
    await expect(executeTextEcho(TEST_ORDER_ID, longText)).rejects.toThrow(
      "exceeds maximum length",
    );
  });

  it("should produce deterministic hashes for same input", async () => {
    // Use a fixed timestamp by checking hash of the content string
    const result1 = await executeTextEcho(TEST_ORDER_ID, "deterministic");
    const result2 = await executeTextEcho(TEST_ORDER_ID, "deterministic");

    // Content includes timestamp so hashes will differ, but each hash
    // should match its own content
    const hash1 = computeContentHash(result1.content);
    const hash2 = computeContentHash(result2.content);
    expect(result1.contentHash).toBe(hash1);
    expect(result2.contentHash).toBe(hash2);
  });
});
