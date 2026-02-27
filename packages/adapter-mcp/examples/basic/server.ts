/**
 * @ivxp/adapter-mcp — Basic MCP Server Example
 *
 * Starts an MCP Server over stdio with IVXP services exposed as MCP Tools.
 *
 * Usage:
 *   IVXP_PRIVATE_KEY=0x... IVXP_PROVIDER_URL=http://... npx tsx server.ts
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { IVXPMCPAdapter } from "@ivxp/adapter-mcp";

// ---------------------------------------------------------------------------
// Env validation — fail fast with clear messages
// ---------------------------------------------------------------------------

const REQUIRED_ENV_VARS = ["IVXP_PRIVATE_KEY", "IVXP_PROVIDER_URL"] as const;

for (const envVar of REQUIRED_ENV_VARS) {
  if (!process.env[envVar]) {
    console.error(`Error: Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const providerUrl = process.env.IVXP_PROVIDER_URL!;
const privateKey = process.env.IVXP_PRIVATE_KEY!;
const network = process.env.IVXP_NETWORK ?? "base-sepolia";

// ---------------------------------------------------------------------------
// Adapter + MCP Server setup
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const adapter = new IVXPMCPAdapter({ providerUrl, privateKey, network });

  // IMPORTANT: always call init() before getTools() — this fetches the
  // provider catalog and generates the MCP tool schemas.
  console.error("Initializing IVXP MCP Adapter...");
  await adapter.init();

  const tools = adapter.getTools();
  console.error(`Loaded ${tools.length} tool(s) from provider catalog`);

  const server = new Server(
    { name: "ivxp-mcp-server", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const result = await adapter.handleToolCall(request.params.name, request.params.arguments);
    // MCPToolResult is structurally compatible with CallToolResult (same {isError, content} shape)
    return result as CallToolResult;
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("IVXP MCP Server running on stdio");
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error("Fatal:", message);
  process.exit(1);
});
