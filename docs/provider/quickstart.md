---
title: Provider Quick Start
description: Fast path to run an IVXP provider and validate the first order flow.
---

This page gives you the shortest safe path to bring up a Provider and complete one full order lifecycle.

## Prerequisites

- Node.js 20+
- pnpm 10+
- A provider private key (`0x` + 64 hex chars)
- Base network access (`base-sepolia` for test, `base-mainnet` for production)

## Step 1: Install and Build

```bash
pnpm install
pnpm build
```

## Step 2: Create a Minimal Provider

```typescript
import { createIVXPProvider } from "@ivxp/sdk";

const provider = createIVXPProvider({
  privateKey: process.env.PROVIDER_PRIVATE_KEY as `0x${string}`,
  network: (process.env.IVXP_NETWORK ?? "base-sepolia") as "base-sepolia" | "base-mainnet",
  providerName: "My IVXP Provider",
  services: [
    {
      type: "text_echo",
      description: "Echoes back the input text",
      base_price_usdc: 0.1,
      estimated_delivery_hours: 0.01,
    },
  ],
});

provider.registerServiceHandler("text_echo", async (order) => {
  return {
    content: `Echo: ${order.serviceType} order ${order.orderId} processed`,
    content_type: "text/plain",
  };
});

const { host, port } = await provider.start();
console.log(`Provider running at http://${host}:${port}`);
```

## Step 3: Verify Endpoints

Provider should expose these protocol endpoints:

| Method | Path                        | Purpose                             |
| ------ | --------------------------- | ----------------------------------- |
| GET    | `/ivxp/catalog`             | Return service catalog              |
| POST   | `/ivxp/request`             | Return quote                        |
| POST   | `/ivxp/deliver`             | Accept payment proof and start work |
| GET    | `/ivxp/status/{order_id}`   | Return current order status         |
| GET    | `/ivxp/download/{order_id}` | Return final deliverable            |

## Step 4: Run a Baseline Order Flow

From a client (SDK or adapter), validate:

1. `GET /ivxp/catalog` returns services.
2. `POST /ivxp/request` returns `order_id` and quote.
3. Payment is submitted and verifiable on-chain.
4. `POST /ivxp/deliver` returns accepted response.
5. `GET /ivxp/status/{order_id}` reaches terminal status.
6. `GET /ivxp/download/{order_id}` returns deliverable payload.

## Contract Note: Endpoint Paths

Before integration, confirm which provider contract your client expects:

- Protocol route set: `/ivxp/catalog`, `/ivxp/request`, `/ivxp/deliver`, `/ivxp/status/{order_id}`, `/ivxp/download/{order_id}`
- SDK workflow route set: `/ivxp/orders/{orderId}/*` may be used by some SDK flows

Keep provider and client on the same contract to avoid false integration failures.
For endpoint/signature profile pairing, see [Integration Profiles Quick Reference](../protocol/integration-profiles.md).

## Step 5: Shutdown

```typescript
await provider.stop();
```

## Next

- Deep configuration and storage: [SDK Provider Guide](./sdk-provider-guide.md)
- Framework integration: [Adapter Quickstart](./adapter-quickstart.md)
- Production readiness: [Conformance Checklist](./conformance-checklist.md)
