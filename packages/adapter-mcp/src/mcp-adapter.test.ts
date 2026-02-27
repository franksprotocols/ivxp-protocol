import { describe, it, expect, vi, beforeEach } from "vitest";
import { assertNotSSRF } from "./ssrf-guard.js";

// --- Mock @ivxp/sdk before importing adapter ---

const mockGetCatalog = vi.fn().mockResolvedValue({
  protocol: "IVXP/1.0",
  provider: "did:ivxp:test",
  wallet_address: ("0x" + "0".repeat(40)) as `0x${string}`,
  services: [
    {
      type: "summarize",
      base_price_usdc: 0.05,
      estimated_delivery_hours: 1,
    },
  ],
});

const mockRequestService = vi.fn().mockResolvedValue({
  deliverable: { text: "Summary result" },
});

vi.mock("@ivxp/sdk", () => {
  class IVXPError extends Error {
    public readonly code: string;
    constructor(message: string, code: string) {
      super(message);
      this.name = "IVXPError";
      this.code = code;
    }
  }
  return {
    IVXPClient: vi.fn().mockImplementation(() => ({
      getCatalog: mockGetCatalog,
      requestService: mockRequestService,
    })),
    IVXPError,
  };
});

import { IVXPMCPAdapter } from "./mcp-adapter.js";
import { IVXPError } from "@ivxp/sdk";

const ADAPTER_CONFIG = {
  providerUrl: "https://provider.example.com",
  privateKey: "0x" + "ab".repeat(32),
  network: "base-sepolia",
};

const VALID_ARGS = {
  provider: "https://provider.example.com",
  service: "summarize",
  input: { text: "Hello world" },
  budget_usdc: 1.0,
};

// ---------------------------------------------------------------------------
// assertNotSSRF
// ---------------------------------------------------------------------------

describe("assertNotSSRF", () => {
  it("allows public URLs", () => {
    expect(() => assertNotSSRF("https://provider.example.com/api")).not.toThrow();
  });

  it.each([
    ["http://localhost/api", "localhost"],
    ["http://127.0.0.1/api", "127."],
    ["http://10.0.0.1/api", "10."],
    ["http://192.168.1.1/api", "192.168."],
    ["http://172.16.0.1/api", "172.16"],
    ["http://169.254.1.1/api", "169.254."],
    ["http://0.0.0.0/api", "0.0.0.0"],
    ["http://[::1]/api", "::1"],
    ["http://[::ffff:127.0.0.1]/api", "::ffff:"],
    ["http://[fe80::1]/api", "fe80"],
    ["http://[fc00::1]/api", "fc00"],
  ])("blocks %s", (url) => {
    expect(() => assertNotSSRF(url)).toThrow("SSRF guard");
  });

  it("blocks IPv6 link-local fe80", () => {
    expect(() => assertNotSSRF("http://[fe80::1]/api")).toThrow("SSRF guard");
  });

  it("blocks non-http schemes", () => {
    expect(() => assertNotSSRF("file:///etc/passwd")).toThrow("SSRF guard");
    expect(() => assertNotSSRF("ftp://example.com/file")).toThrow("SSRF guard");
  });

  it("throws on invalid URL", () => {
    expect(() => assertNotSSRF("not-a-url")).toThrow("SSRF guard: invalid URL");
  });
});

// ---------------------------------------------------------------------------
// IVXPMCPAdapter
// ---------------------------------------------------------------------------

describe("IVXPMCPAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCatalog.mockResolvedValue({
      protocol: "IVXP/1.0",
      provider: "did:ivxp:test",
      wallet_address: ("0x" + "0".repeat(40)) as `0x${string}`,
      services: [
        {
          type: "summarize",
          base_price_usdc: 0.05,
          estimated_delivery_hours: 1,
        },
      ],
    });
    mockRequestService.mockResolvedValue({
      deliverable: { text: "Summary result" },
    });
  });

  // AC1: init() + getTools()
  describe("init()", () => {
    it("completes within 2000ms", async () => {
      const adapter = new IVXPMCPAdapter(ADAPTER_CONFIG);
      const start = Date.now();
      await adapter.init();
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(2000);
    });
  });

  describe("getTools()", () => {
    it("throws before init()", () => {
      const adapter = new IVXPMCPAdapter(ADAPTER_CONFIG);
      expect(() => adapter.getTools()).toThrow("not initialized");
    });

    it("returns MCPTool[] after init()", async () => {
      const adapter = new IVXPMCPAdapter(ADAPTER_CONFIG);
      await adapter.init();
      const tools = adapter.getTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe("ivxp_call_service");
      expect(tools[0].inputSchema.type).toBe("object");
    });

    it("returns a copy (not the internal array)", async () => {
      const adapter = new IVXPMCPAdapter(ADAPTER_CONFIG);
      await adapter.init();
      const a = adapter.getTools();
      const b = adapter.getTools();
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });
  });

  // AC2: handleToolCall success
  describe("handleToolCall()", () => {
    // T1: handleToolCall before init
    it("returns error when called before init()", async () => {
      const freshAdapter = new IVXPMCPAdapter({
        providerUrl: "https://provider.example.com",
        privateKey: "0xdeadbeef",
        network: "testnet",
      });
      const result = await freshAdapter.handleToolCall("ivxp_call_service", {
        provider: "https://provider.example.com",
        service: "summarize",
        input: {},
        budget_usdc: 0.1,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/init\(\)/);
    });

    it("returns deliverable on success", async () => {
      const adapter = new IVXPMCPAdapter(ADAPTER_CONFIG);
      await adapter.init();

      const result = await adapter.handleToolCall("ivxp_call_service", VALID_ARGS);

      expect(result.isError).toBe(false);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");
      expect(JSON.parse(result.content[0].text)).toEqual({
        text: "Summary result",
      });
    });

    // AC7: unknown tool name
    it("returns error for unknown tool name", async () => {
      const adapter = new IVXPMCPAdapter(ADAPTER_CONFIG);
      await adapter.init();

      const result = await adapter.handleToolCall("unknown_tool", {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unknown tool");
    });

    it("returns error for invalid arguments", async () => {
      const adapter = new IVXPMCPAdapter(ADAPTER_CONFIG);
      await adapter.init();

      const result = await adapter.handleToolCall("ivxp_call_service", {
        provider: 123,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Invalid arguments");
    });

    // AC3: SSRF guard integration
    it.each([
      "http://localhost/api",
      "http://127.0.0.1/api",
      "http://10.0.0.1/api",
      "http://192.168.1.1/api",
      "http://172.16.0.1/api",
      "http://[::1]/api",
      "http://[::ffff:127.0.0.1]/api",
      "http://[fe80::1]/api",
      "http://[fc00::1]/api",
    ])("blocks SSRF for %s", async (blockedUrl) => {
      const adapter = new IVXPMCPAdapter(ADAPTER_CONFIG);
      await adapter.init();

      const result = await adapter.handleToolCall("ivxp_call_service", {
        ...VALID_ARGS,
        provider: blockedUrl,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("SSRF guard");
    });

    // T1: scheme bypass
    it("SSRF guard blocks non-http schemes", async () => {
      const adapter = new IVXPMCPAdapter(ADAPTER_CONFIG);
      await adapter.init();

      const result = await adapter.handleToolCall("ivxp_call_service", {
        ...VALID_ARGS,
        provider: "file:///etc/passwd",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/SSRF guard/);
    });

    // T1: budget_usdc validation
    it.each([{ budget_usdc: -1 }, { budget_usdc: NaN }, { budget_usdc: Infinity }])(
      "rejects invalid budget_usdc: %o",
      async ({ budget_usdc }) => {
        const adapter = new IVXPMCPAdapter(ADAPTER_CONFIG);
        await adapter.init();

        const result = await adapter.handleToolCall("ivxp_call_service", {
          ...VALID_ARGS,
          budget_usdc,
        });

        expect(result.isError).toBe(true);
      },
    );

    // T1: array input rejection
    it("rejects array input", async () => {
      const adapter = new IVXPMCPAdapter(ADAPTER_CONFIG);
      await adapter.init();

      const result = await adapter.handleToolCall("ivxp_call_service", {
        ...VALID_ARGS,
        input: [1, 2, 3],
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/plain object/);
    });

    // AC4: IVXPError conversion
    it("converts IVXPError to MCP error result", async () => {
      mockRequestService.mockRejectedValueOnce(new IVXPError("Payment failed", "PAYMENT_FAILED"));

      const adapter = new IVXPMCPAdapter(ADAPTER_CONFIG);
      await adapter.init();

      const result = await adapter.handleToolCall("ivxp_call_service", VALID_ARGS);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("IVXP PAYMENT_FAILED: Payment failed");
    });

    it("converts generic errors to MCP error result", async () => {
      mockRequestService.mockRejectedValueOnce(new Error("Network timeout"));

      const adapter = new IVXPMCPAdapter(ADAPTER_CONFIG);
      await adapter.init();

      const result = await adapter.handleToolCall("ivxp_call_service", VALID_ARGS);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Network timeout");
    });
  });
});
