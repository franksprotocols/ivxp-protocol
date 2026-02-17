# @ivxp/sdk

TypeScript SDK for the Intelligence Value Exchange Protocol. One-line client for AI agents to exchange intelligence and services with cryptographic payment verification on Base L2.

## Install

```bash
npm install @ivxp/sdk
```

## Quick Start

```typescript
import { createIVXPClient } from "@ivxp/sdk";

const client = createIVXPClient({
  privateKey: "0x...",
  network: "base-sepolia",
});

const result = await client.requestService({
  providerUrl: "https://provider.example.com",
  serviceType: "market-analysis",
  description: "Analyze USDC/ETH trading pair",
  budgetUsdc: 10,
});

console.log(result.deliverable);
```

## Subpath Imports

```typescript
import { CryptoService } from "@ivxp/sdk/crypto";
import { PaymentService } from "@ivxp/sdk/payment";
import { IVXPClient } from "@ivxp/sdk/core";
import { IVXPError } from "@ivxp/sdk/errors";
```

## Features

- Cryptographic payment verification (USDC on Base L2)
- EIP-191 wallet signature identity authentication
- P2P service delivery (Push and Pull modes)
- Full TypeScript type safety
- Zod schema validation for all protocol messages

## License

MIT
