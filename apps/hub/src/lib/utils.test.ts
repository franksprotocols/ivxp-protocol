import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getBlockExplorerTxUrl,
  copyToClipboard,
  toSnakeCase,
  toWireFormat,
  formatRelativeTime,
} from "./utils";

// ---------------------------------------------------------------------------
// getBlockExplorerTxUrl
// ---------------------------------------------------------------------------

describe("getBlockExplorerTxUrl", () => {
  it("returns Base Sepolia URL for chain 84532", () => {
    expect(getBlockExplorerTxUrl("0xabc", 84532)).toBe(
      "https://sepolia.basescan.org/tx/0xabc",
    );
  });

  it("returns Base Mainnet URL for chain 8453", () => {
    expect(getBlockExplorerTxUrl("0xdef", 8453)).toBe(
      "https://basescan.org/tx/0xdef",
    );
  });

  it("defaults to Base Sepolia for unknown chain", () => {
    expect(getBlockExplorerTxUrl("0x123", 1)).toBe(
      "https://sepolia.basescan.org/tx/0x123",
    );
  });
});

// ---------------------------------------------------------------------------
// copyToClipboard
// ---------------------------------------------------------------------------

describe("copyToClipboard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true when navigator.clipboard.writeText succeeds", async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

    const result = await copyToClipboard("hello");
    expect(result).toBe(true);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("hello");
  });

  it("falls back to execCommand when clipboard API fails", async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error("denied")),
      },
    });
    document.execCommand = vi.fn().mockReturnValue(true);

    const result = await copyToClipboard("fallback");
    expect(result).toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith("copy");
  });
});

// ---------------------------------------------------------------------------
// toSnakeCase
// ---------------------------------------------------------------------------

describe("toSnakeCase", () => {
  it("converts camelCase to snake_case", () => {
    expect(toSnakeCase("orderId")).toBe("order_id");
    expect(toSnakeCase("txHash")).toBe("tx_hash");
    expect(toSnakeCase("priceUsdc")).toBe("price_usdc");
  });

  it("handles already snake_case strings", () => {
    expect(toSnakeCase("order_id")).toBe("order_id");
  });

  it("handles consecutive uppercase letters", () => {
    expect(toSnakeCase("HTTPSConnection")).toBe("https_connection");
    expect(toSnakeCase("getHTTPResponse")).toBe("get_http_response");
  });

  it("handles single-word lowercase", () => {
    expect(toSnakeCase("status")).toBe("status");
  });
});

// ---------------------------------------------------------------------------
// toWireFormat
// ---------------------------------------------------------------------------

describe("toWireFormat", () => {
  it("converts object keys to snake_case", () => {
    const result = toWireFormat({ orderId: "abc", txHash: "0x1" });
    expect(result).toEqual({ order_id: "abc", tx_hash: "0x1" });
  });

  it("handles nested objects", () => {
    const result = toWireFormat({ outerKey: { innerKey: "val" } });
    expect(result).toEqual({ outer_key: { inner_key: "val" } });
  });

  it("handles arrays", () => {
    const result = toWireFormat([{ myKey: 1 }, { myKey: 2 }]);
    expect(result).toEqual([{ my_key: 1 }, { my_key: 2 }]);
  });

  it("returns primitives unchanged", () => {
    expect(toWireFormat("hello")).toBe("hello");
    expect(toWireFormat(42)).toBe(42);
    expect(toWireFormat(null)).toBeNull();
    expect(toWireFormat(undefined)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// formatRelativeTime
// ---------------------------------------------------------------------------

describe("formatRelativeTime", () => {
  it("returns 'just now' for very recent dates", () => {
    expect(formatRelativeTime(new Date())).toBe("just now");
  });

  it("returns seconds ago for <60s", () => {
    const date = new Date(Date.now() - 30_000);
    expect(formatRelativeTime(date)).toBe("30s ago");
  });

  it("returns minutes ago for <60m", () => {
    const date = new Date(Date.now() - 5 * 60_000);
    expect(formatRelativeTime(date)).toBe("5m ago");
  });

  it("returns hours ago for >=60m", () => {
    const date = new Date(Date.now() - 2 * 60 * 60_000);
    expect(formatRelativeTime(date)).toBe("2h ago");
  });
});
