# @ivxp/adapter-mcp -- Basic MCP Server Example

Demonstrates how to expose IVXP services as MCP Tools using `IVXPMCPAdapter`. A simulated MCP client spawns the server, lists tools, and makes an `ivxp_call_service` call.

## Prerequisites

- Node.js 18+
- pnpm

From the monorepo root:

```bash
pnpm install
pnpm --filter @ivxp/adapter-mcp build
```

## Standalone Install

```bash
npm install @ivxp/adapter-mcp @ivxp/sdk @modelcontextprotocol/sdk
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `IVXP_PRIVATE_KEY` | Yes | 0x-prefixed 64-char hex private key (32 bytes) |
| `IVXP_PROVIDER_URL` | Yes | Provider base URL (e.g. `http://localhost:3001`) |
| `IVXP_NETWORK` | No | `base-sepolia` (default) or `base-mainnet` |

> Replace `0x...` with your actual 64-hex-character private key (e.g. from a test wallet).
> The server validates the key format on startup and will exit with an error if it is missing or malformed.

## Run the Example

> This example is designed to run within the monorepo. Run `pnpm install` at the repo root first, then build the adapter.

`client.ts` automatically spawns `server.ts` as a subprocess over stdio — you only need to run the client:

```bash
cd packages/adapter-mcp/examples/basic
IVXP_PRIVATE_KEY=0xYOUR_KEY IVXP_PROVIDER_URL=http://localhost:3001 pnpm start
```

Or directly with `tsx`:

```bash
IVXP_PRIVATE_KEY=0xYOUR_KEY IVXP_PROVIDER_URL=http://localhost:3001 npx tsx client.ts
```

> Note: the stdio transport means the server process is not separately accessible from another terminal. Running `server.ts` standalone is only useful when integrating with an external MCP host (e.g. Claude Desktop) that manages the subprocess itself.

## MCP Server Setup Pattern

The key pattern is: **always call `adapter.init()` before registering tools**.

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { IVXPMCPAdapter } from "@ivxp/adapter-mcp";

const adapter = new IVXPMCPAdapter({ providerUrl, privateKey, network });

// 1. Initialize — fetches provider catalog, generates tool schemas
await adapter.init();

// 2. Create MCP Server
const server = new Server(
  { name: "ivxp-mcp-server", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

// 3. Register handlers AFTER init
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: adapter.getTools(),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) =>
  adapter.handleToolCall(request.params.name, request.params.arguments),
);

// 4. Connect transport
const transport = new StdioServerTransport();
await server.connect(transport);
```

## Expected Output

```
Connecting to IVXP MCP Server...
Available tools: [ 'ivxp_call_service' ]

Calling ivxp_call_service with service="echo"...
Tool result: {
  "isError": false,
  "content": [
    { "type": "text", "text": "..." }
  ]
}
```
