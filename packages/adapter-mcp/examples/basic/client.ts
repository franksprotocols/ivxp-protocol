/**
 * @ivxp/adapter-mcp — Basic MCP Client Example
 *
 * Spawns the MCP server as a child process, lists available tools,
 * and makes a simulated ivxp_call_service tool call.
 *
 * Usage:
 *   IVXP_PRIVATE_KEY=0x... IVXP_PROVIDER_URL=http://... npx tsx client.ts
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// ---------------------------------------------------------------------------
// Env validation
// ---------------------------------------------------------------------------

const REQUIRED_ENV_VARS = ["IVXP_PRIVATE_KEY", "IVXP_PROVIDER_URL"] as const;

for (const envVar of REQUIRED_ENV_VARS) {
  if (!process.env[envVar]) {
    console.error(`Error: Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// MCP Client — spawns server.ts as a subprocess
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", join(dirname(fileURLToPath(import.meta.url)), "server.ts")],
    env: {
      IVXP_PROVIDER_URL: process.env.IVXP_PROVIDER_URL!,
      IVXP_PRIVATE_KEY: process.env.IVXP_PRIVATE_KEY!,
      IVXP_NETWORK: process.env.IVXP_NETWORK ?? "base-sepolia",
    },
  });

  const client = new Client(
    { name: "ivxp-mcp-client-example", version: "0.1.0" },
    { capabilities: {} },
  );

  console.log("Connecting to IVXP MCP Server...");
  await client.connect(transport);

  // 1. List available tools
  const { tools } = await client.listTools();
  console.log(
    "Available tools:",
    tools.map((t) => t.name),
  );

  if (tools.length === 0) {
    console.error(
      "No tools available — check IVXP_PROVIDER_URL and that the provider catalog is non-empty",
    );
    await client.close();
    process.exit(1);
  }

  // 2. Extract the first service type from the tool schema enum
  const firstTool = tools[0]!;
  const serviceEnum = (
    firstTool.inputSchema as {
      properties?: { service?: { enum?: string[] } };
    }
  ).properties?.service?.enum;
  const serviceType = serviceEnum?.[0] ?? "echo";

  // 3. Call the tool
  console.log(`\nCalling ${firstTool.name} with service="${serviceType}"...`);
  const result = await client.callTool({
    name: "ivxp_call_service",
    arguments: {
      provider: process.env.IVXP_PROVIDER_URL!,
      service: serviceType,
      input: { text: "Hello from MCP example" },
      budget_usdc: 0.1,
    },
  });

  console.log("Tool result:", JSON.stringify(result, null, 2));
  await client.close();
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error("Example failed:", message);
  process.exit(1);
});
