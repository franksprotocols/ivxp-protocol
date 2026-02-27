# A2A Adapter End-to-End Example

Demonstrates the full IVXP flow through the A2A adapter:
`catalog -> quote -> payment -> deliver -> download`

## Environment Variables

| Variable            | Required | Description                                    |
| ------------------- | -------- | ---------------------------------------------- |
| `IVXP_PRIVATE_KEY`  | Yes      | 0x-prefixed 64-char hex private key (32 bytes) |
| `IVXP_NETWORK`      | No       | `base-sepolia` (default) or `base-mainnet`     |
| `IVXP_PROVIDER_URL` | No       | Provider URL (only for standalone client mode) |

## Quick Start

```bash
cp .env.example .env
# Edit .env with your private key

# From the examples/basic/ directory:
IVXP_PRIVATE_KEY=0x... npx tsx run.ts

# Or from anywhere in the monorepo:
IVXP_PRIVATE_KEY=0x... pnpm --filter @ivxp/adapter-a2a example
```

## Minimal Client Snippet

```typescript
import { IVXPA2AClientAdapter } from "@ivxp/adapter-a2a";

const adapter = new IVXPA2AClientAdapter({
  privateKey: process.env.IVXP_PRIVATE_KEY as `0x${string}`,
  network: "base-sepolia",
});

const catalog = await adapter.getCatalog("http://localhost:3001");
const quote = await adapter.requestQuote("http://localhost:3001", {
  serviceType: "text_echo",
  description: "Hello",
  budgetUsdc: 5,
});
console.log("Order:", quote.orderId);
```

## Minimal Provider Snippet

```typescript
import { IVXPProvider } from "@ivxp/sdk";

const provider = new IVXPProvider({
  privateKey: process.env.IVXP_PRIVATE_KEY as `0x${string}`,
  services: [{ type: "text_echo", base_price_usdc: 1, estimated_delivery_hours: 0.01 }],
  serviceHandlers: new Map([
    ["text_echo", async () => ({ content: "Echo: hello!", content_type: "text/plain" })],
  ]),
});

const { port } = await provider.start();
console.log(`Provider listening on port ${port}`);
```

> See `provider.ts` for the full example with env var loading and graceful shutdown.

## Files

- `provider.ts` -- Starts an IVXPProvider HTTP server with text_echo service
- `client.ts` — Runs the full flow against a provider URL
- `run.ts` — Orchestrates both: starts provider, runs client, verifies result
- `.env.example` — Template for environment variables
