/**
 * IVXPMCPAdapter — bridges IVXP services into the MCP Tool interface.
 *
 * Usage:
 *   const adapter = new IVXPMCPAdapter({ providerUrl, privateKey, network });
 *   await adapter.init();
 *   const tools = adapter.getTools();
 *   const result = await adapter.handleToolCall('ivxp_call_service', args);
 */

import { IVXPClient, IVXPError } from "@ivxp/sdk";
import type { ServiceCatalog } from "@ivxp/sdk";
import type { IVXPMCPAdapterConfig, MCPTool } from "./types.js";
import { SchemaGenerator } from "./schema-generator.js";
import { assertNotSSRF } from "./ssrf-guard.js";

interface MCPToolResultContent {
  readonly type: "text";
  readonly text: string;
}

interface MCPToolResult {
  readonly isError: boolean;
  readonly content: readonly MCPToolResultContent[];
}

interface ParsedArgs {
  readonly ok: true;
  readonly provider: string;
  readonly service: string;
  readonly input: Record<string, unknown>;
  readonly budget_usdc: number;
}

interface ParseError {
  readonly ok: false;
  readonly error: string;
}

function parseArgs(args: unknown): ParsedArgs | ParseError {
  const a = args as Record<string, unknown>;

  if (
    typeof a.provider !== "string" ||
    typeof a.service !== "string" ||
    typeof a.budget_usdc !== "number"
  ) {
    return {
      ok: false,
      error:
        "Invalid arguments: expected { provider: string, service: string, input: object, budget_usdc: number }",
    };
  }

  // H5: reject arrays as input
  const inputVal = a.input ?? {};
  if (Array.isArray(inputVal)) {
    return {
      ok: false,
      error: "Invalid arguments: input must be a plain object, not an array",
    };
  }

  if (typeof inputVal !== "object" || inputVal === null) {
    return {
      ok: false,
      error:
        "Invalid arguments: expected { provider: string, service: string, input: object, budget_usdc: number }",
    };
  }

  // H4: validate budget_usdc is finite and non-negative
  if (!Number.isFinite(a.budget_usdc) || (a.budget_usdc as number) < 0) {
    return {
      ok: false,
      error: "Invalid arguments: budget_usdc must be a non-negative finite number",
    };
  }

  return {
    ok: true,
    provider: a.provider,
    service: a.service,
    input: inputVal as Record<string, unknown>,
    budget_usdc: a.budget_usdc as number,
  };
}

export class IVXPMCPAdapter {
  private readonly config: Readonly<IVXPMCPAdapterConfig>;
  private client: IVXPClient | null = null;
  private tools: readonly MCPTool[] = [];
  private initialized = false;

  constructor(config: IVXPMCPAdapterConfig) {
    this.config = { ...config };
  }

  async init(): Promise<void> {
    // H1: guard the config providerUrl before making any network call
    assertNotSSRF(this.config.providerUrl);

    this.client = new IVXPClient({
      privateKey: this.config.privateKey as `0x${string}`,
      network: this.config.network as "base-sepolia",
    });

    const catalogOutput = await this.client.getCatalog(this.config.providerUrl);

    // H3: validate catalog shape before using it
    if (
      !catalogOutput ||
      !Array.isArray(
        (catalogOutput as Record<string, unknown>).services,
      )
    ) {
      throw new Error(
        "IVXPMCPAdapter: invalid catalog response from provider",
      );
    }

    // SchemaGenerator expects the wire-format ServiceCatalog type.
    // getCatalog() returns ServiceCatalogOutput (camelCase). The fields
    // SchemaGenerator actually reads (.services[].type) are identical in
    // both shapes, so the cast is safe.
    const catalog = catalogOutput as unknown as ServiceCatalog;
    this.tools = SchemaGenerator.generate(catalog);
    this.initialized = true;
  }

  getTools(): MCPTool[] {
    if (!this.initialized) {
      throw new Error(
        "IVXPMCPAdapter not initialized. Call init() before getTools().",
      );
    }
    return [...this.tools];
  }

  async handleToolCall(name: string, args: unknown): Promise<MCPToolResult> {
    // H2: guard against calls before init()
    if (!this.initialized || !this.client) {
      return errorResult(
        "IVXPMCPAdapter: call init() before handleToolCall()",
      );
    }

    if (name !== "ivxp_call_service") {
      return errorResult(`Unknown tool: "${name}"`);
    }

    const parsed = parseArgs(args);
    if (!parsed.ok) {
      return errorResult(parsed.error);
    }

    try {
      assertNotSSRF(parsed.provider);
    } catch (err) {
      return errorResult(
        err instanceof Error ? err.message : "SSRF guard: blocked",
      );
    }

    try {
      const result = await this.client.requestService({
        providerUrl: parsed.provider,
        serviceType: parsed.service,
        description: JSON.stringify(parsed.input),
        budgetUsdc: parsed.budget_usdc,
      });

      return {
        isError: false,
        content: [{ type: "text", text: JSON.stringify(result.deliverable) }],
      };
    } catch (err) {
      if (err instanceof IVXPError) {
        return errorResult(`IVXP ${err.code}: ${err.message}`);
      }
      return errorResult(err instanceof Error ? err.message : "Unknown error");
    }
  }
}

function errorResult(message: string): MCPToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}
