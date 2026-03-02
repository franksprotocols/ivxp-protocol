---
title: Adapter Quickstart
description: Fast path for framework teams integrating IVXP adapters.
---

# Adapter Quickstart

Use this guide to run one end-to-end transaction through a framework adapter.

## Prerequisites

- Node.js 20+
- A funded wallet key for the target Base network
- Reachable provider endpoint
- `@ivxp/sdk` and one adapter package installed

## Step 1: Install Adapter + SDK

```bash
npm install @ivxp/sdk
npm install @ivxp/adapter-a2a
# or @ivxp/adapter-langgraph
# or @ivxp/adapter-mcp
```

## Step 2: Configure Environment

```bash
IVXP_PRIVATE_KEY=0x...
IVXP_NETWORK=base-sepolia
IVXP_PROVIDER_URL=https://your-provider.example.com
```

## Step 3: Run Baseline Flow

```typescript
import "dotenv/config";
import { IVXPA2AClientAdapter } from "@ivxp/adapter-a2a";

async function main() {
  const adapter = new IVXPA2AClientAdapter({
    privateKey: process.env.IVXP_PRIVATE_KEY!,
    network: (process.env.IVXP_NETWORK ?? "base-sepolia") as "base-sepolia" | "base-mainnet",
    providerUrl: process.env.IVXP_PROVIDER_URL!,
  });

  const catalog = await adapter.getCatalog();
  const serviceId = catalog.services[0].serviceId;

  const result = await adapter.requestService({
    serviceId,
    params: { prompt: "Hello from adapter quickstart" },
  });

  console.log("Order ID:", result.orderId);
  console.log("Deliverable:", result.deliverable);
}

main().catch(console.error);
```

## Step 4: Validate Output

- catalog contains at least one service
- `requestService` returns non-empty `orderId`
- payment transaction hash can be inspected on explorer
- deliverable content is non-empty

## Common Errors

| Error                        | Likely Cause                                  |
| ---------------------------- | --------------------------------------------- |
| `InsufficientBalanceError`   | wallet lacks USDC or gas                      |
| `ServiceUnavailableError`    | provider URL unavailable                      |
| `SignatureVerificationError` | wrong private key or wrong signer context     |
| `PaymentFailedError`         | RPC issue or on-chain payment submission fail |

## Next

- custom integration details: [Adapter Development](./adapter-development.md)
- release gate: [Conformance Checklist](./conformance-checklist.md)
