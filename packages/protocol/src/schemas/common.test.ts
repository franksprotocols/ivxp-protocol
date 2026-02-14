/**
 * Unit tests for common Zod schemas.
 */

import { describe, expect, it } from "vitest";

import {
  DeliveryFormatSchema,
  HexAddressLenientSchema,
  HexAddressSchema,
  HexHashSchema,
  HexSignatureSchema,
  ISOTimestampSchema,
  IVXPMessageTypeSchema,
  NetworkIdSchema,
  OrderStatusSchema,
  ProtocolVersionSchema,
} from "./common.js";

// ============================================================================
// ProtocolVersionSchema
// ============================================================================

describe("ProtocolVersionSchema", () => {
  it("should accept 'IVXP/1.0'", () => {
    const result = ProtocolVersionSchema.parse("IVXP/1.0");
    expect(result).toBe("IVXP/1.0");
  });

  it("should reject invalid protocol versions", () => {
    expect(() => ProtocolVersionSchema.parse("IVXP/2.0")).toThrow();
    expect(() => ProtocolVersionSchema.parse("HTTP/1.1")).toThrow();
    expect(() => ProtocolVersionSchema.parse("")).toThrow();
    expect(() => ProtocolVersionSchema.parse(123)).toThrow();
  });
});

// ============================================================================
// HexAddressSchema
// ============================================================================

describe("HexAddressSchema", () => {
  it("should accept valid Ethereum addresses", () => {
    const result = HexAddressSchema.parse("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    expect(result).toBe("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913");
  });

  it("should normalize addresses to lowercase", () => {
    const result = HexAddressSchema.parse("0xABCDEF1234567890ABCDEF1234567890ABCDEF12");
    expect(result).toBe("0xabcdef1234567890abcdef1234567890abcdef12");
  });

  it("should accept all-lowercase addresses", () => {
    const result = HexAddressSchema.parse("0xabcdef1234567890abcdef1234567890abcdef12");
    expect(result).toBe("0xabcdef1234567890abcdef1234567890abcdef12");
  });

  it("should reject addresses without 0x prefix", () => {
    expect(() => HexAddressSchema.parse("833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")).toThrow();
  });

  it("should reject addresses with wrong length", () => {
    expect(() => HexAddressSchema.parse("0x1234")).toThrow();
    expect(() => HexAddressSchema.parse("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA0291300")).toThrow();
  });

  it("should reject non-hex characters", () => {
    expect(() => HexAddressSchema.parse("0xGGGGGGfCD6eDb6E08f4c7C32D4f71b54bdA02913")).toThrow();
  });

  it("should reject empty string", () => {
    expect(() => HexAddressSchema.parse("")).toThrow();
  });
});

// ============================================================================
// HexAddressLenientSchema
// ============================================================================

describe("HexAddressLenientSchema", () => {
  it("should accept full-length addresses", () => {
    const result = HexAddressLenientSchema.parse("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    expect(result).toBe("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913");
  });

  it("should accept shorter hex strings with 0x prefix", () => {
    const result = HexAddressLenientSchema.parse("0x1234");
    expect(result).toBe("0x1234");
  });

  it("should reject strings without 0x prefix", () => {
    expect(() => HexAddressLenientSchema.parse("1234")).toThrow();
  });

  it("should reject bare 0x", () => {
    expect(() => HexAddressLenientSchema.parse("0x")).toThrow();
  });
});

// ============================================================================
// HexSignatureSchema
// ============================================================================

describe("HexSignatureSchema", () => {
  // EIP-191 signature: 0x + 130 hex chars (65 bytes = r:32 + s:32 + v:1)
  const VALID_SIGNATURE = "0x" + "ab".repeat(65);

  it("should accept valid EIP-191 signatures (0x + 130 hex chars)", () => {
    const result = HexSignatureSchema.parse(VALID_SIGNATURE);
    expect(result).toBe(VALID_SIGNATURE);
  });

  it("should reject signatures that are too short", () => {
    expect(() => HexSignatureSchema.parse("0xabcdef1234")).toThrow();
  });

  it("should reject signatures that are too long", () => {
    expect(() => HexSignatureSchema.parse("0x" + "ab".repeat(66))).toThrow();
  });

  it("should reject non-hex strings", () => {
    expect(() => HexSignatureSchema.parse("notahex")).toThrow();
  });

  it("should reject empty string", () => {
    expect(() => HexSignatureSchema.parse("")).toThrow();
  });
});

// ============================================================================
// HexHashSchema
// ============================================================================

describe("HexHashSchema", () => {
  // Transaction hash: 0x + 64 hex chars (32 bytes)
  const VALID_TX_HASH = "0x" + "ab".repeat(32);

  it("should accept valid 32-byte transaction hashes", () => {
    const result = HexHashSchema.parse(VALID_TX_HASH);
    expect(result).toBe(VALID_TX_HASH);
  });

  it("should reject hashes that are too short", () => {
    expect(() => HexHashSchema.parse("0xdeadbeef")).toThrow();
  });

  it("should reject hashes that are too long", () => {
    expect(() => HexHashSchema.parse("0x" + "ab".repeat(33))).toThrow();
  });

  it("should reject non-hex strings", () => {
    expect(() => HexHashSchema.parse("nothex")).toThrow();
  });
});

// ============================================================================
// NetworkIdSchema
// ============================================================================

describe("NetworkIdSchema", () => {
  it("should accept 'base-mainnet'", () => {
    expect(NetworkIdSchema.parse("base-mainnet")).toBe("base-mainnet");
  });

  it("should accept 'base-sepolia'", () => {
    expect(NetworkIdSchema.parse("base-sepolia")).toBe("base-sepolia");
  });

  it("should reject unsupported networks", () => {
    expect(() => NetworkIdSchema.parse("ethereum")).toThrow();
    expect(() => NetworkIdSchema.parse("base")).toThrow();
    expect(() => NetworkIdSchema.parse("")).toThrow();
  });
});

// ============================================================================
// DeliveryFormatSchema
// ============================================================================

describe("DeliveryFormatSchema", () => {
  it("should accept 'markdown'", () => {
    expect(DeliveryFormatSchema.parse("markdown")).toBe("markdown");
  });

  it("should accept 'json'", () => {
    expect(DeliveryFormatSchema.parse("json")).toBe("json");
  });

  it("should accept 'code'", () => {
    expect(DeliveryFormatSchema.parse("code")).toBe("code");
  });

  it("should reject unsupported formats", () => {
    expect(() => DeliveryFormatSchema.parse("text")).toThrow();
    expect(() => DeliveryFormatSchema.parse("html")).toThrow();
  });
});

// ============================================================================
// ISOTimestampSchema
// ============================================================================

describe("ISOTimestampSchema", () => {
  it("should accept valid ISO 8601 timestamps with Z suffix", () => {
    expect(ISOTimestampSchema.parse("2026-02-05T12:00:00Z")).toBe("2026-02-05T12:00:00Z");
  });

  it("should accept timestamps with timezone offset", () => {
    expect(ISOTimestampSchema.parse("2026-02-05T12:00:00+08:00")).toBe("2026-02-05T12:00:00+08:00");
  });

  it("should accept timestamps with milliseconds", () => {
    expect(ISOTimestampSchema.parse("2026-02-05T12:00:00.123Z")).toBe("2026-02-05T12:00:00.123Z");
  });

  it("should accept timestamps with negative timezone offset", () => {
    expect(ISOTimestampSchema.parse("2026-02-05T12:00:00-05:00")).toBe("2026-02-05T12:00:00-05:00");
  });

  it("should reject non-ISO timestamps", () => {
    expect(() => ISOTimestampSchema.parse("2026-02-05")).toThrow();
    expect(() => ISOTimestampSchema.parse("not-a-date")).toThrow();
    expect(() => ISOTimestampSchema.parse("")).toThrow();
    expect(() => ISOTimestampSchema.parse(12345)).toThrow();
  });

  it("should reject timestamps without timezone", () => {
    expect(() => ISOTimestampSchema.parse("2026-02-05T12:00:00")).toThrow();
  });

  it("should reject structurally valid but unparseable dates", () => {
    // Month 99 does not exist -- regex matches, but Date.parse returns NaN
    expect(() => ISOTimestampSchema.parse("2026-99-05T12:00:00Z")).toThrow();
  });
});

// ============================================================================
// IVXPMessageTypeSchema
// ============================================================================

describe("IVXPMessageTypeSchema", () => {
  const validTypes = [
    "service_catalog",
    "service_request",
    "service_quote",
    "delivery_request",
    "service_delivery",
    "delivery_confirmation",
  ] as const;

  for (const messageType of validTypes) {
    it(`should accept '${messageType}'`, () => {
      expect(IVXPMessageTypeSchema.parse(messageType)).toBe(messageType);
    });
  }

  it("should reject invalid message types", () => {
    expect(() => IVXPMessageTypeSchema.parse("invalid_type")).toThrow();
    expect(() => IVXPMessageTypeSchema.parse("")).toThrow();
  });
});

// ============================================================================
// OrderStatusSchema
// ============================================================================

describe("OrderStatusSchema", () => {
  const validStatuses = ["quoted", "paid", "delivered", "delivery_failed", "confirmed"] as const;

  for (const status of validStatuses) {
    it(`should accept '${status}'`, () => {
      expect(OrderStatusSchema.parse(status)).toBe(status);
    });
  }

  it("should reject invalid status values", () => {
    expect(() => OrderStatusSchema.parse("pending")).toThrow();
    expect(() => OrderStatusSchema.parse("cancelled")).toThrow();
    expect(() => OrderStatusSchema.parse("")).toThrow();
  });
});
