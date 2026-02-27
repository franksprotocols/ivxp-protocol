# IVXP Framework Integration Quickstart (~30 minutes)

This guide walks you through completing a full IVXP transaction using an official adapter package.
By the end, you will have run a `catalog → quote → payment → deliver → download` flow end-to-end.

For deeper implementation details, see the [Adapter Development Guide](../adapter-development-guide.md).

---

## Prerequisites

- **Node.js ≥ 18** — check with `node --version`
- **A wallet funded with test USDC** on Base Sepolia
  - Faucet: https://faucet.circle.com (select "Base Sepolia")
- **An RPC provider URL** for Base Sepolia (e.g., Alchemy, Infura, or a public endpoint)
- **A running IVXP provider** — use the demo provider or any compatible endpoint

---

## Step 1: Install the Adapter

Choose the adapter that matches your framework:

```bash
# A2A (Google Agent-to-Agent Protocol)
npm install @ivxp/adapter-a2a

# LangGraph
npm install @ivxp/adapter-langgraph

# MCP (Model Context Protocol)
npm install @ivxp/adapter-mcp
```

Each adapter depends on `@ivxp/sdk` as a peer dependency:

```bash
npm install @ivxp/sdk
```

---

## Step 2: Configure Environment Variables

Create a `.env` file in your project root. **Never commit this file.**

```bash
# .env
IVXP_PRIVATE_KEY=0x...          # EIP-191 signing key (64-char hex, 32 bytes)
IVXP_NETWORK=base-sepolia       # target network: base-sepolia | base-mainnet
IVXP_PROVIDER_URL=https://...   # IVXP provider endpoint URL
```

Load the variables before running your code:

```bash
# Using dotenv
npm install dotenv
```

```typescript
import "dotenv/config";
```

---

## Step 3: Run a Baseline Transaction

The following example uses `@ivxp/adapter-a2a`. The pattern is identical for other adapters —
replace the import and adapter class name.

```typescript
import "dotenv/config";
import { IVXPA2AClientAdapter } from "@ivxp/adapter-a2a";

async function main() {
  const adapter = new IVXPA2AClientAdapter({
    privateKey: process.env.IVXP_PRIVATE_KEY!,
    network: (process.env.IVXP_NETWORK ?? "base-sepolia") as "base-sepolia" | "base-mainnet",
    providerUrl: process.env.IVXP_PROVIDER_URL!,
  });

  // 1. Fetch the service catalog
  const catalog = await adapter.getCatalog();
  console.log("Services available:", catalog.services.map((s) => s.serviceId));

  // 2. Request a service (catalog → quote → payment → deliver → download)
  const serviceId = catalog.services[0].serviceId;
  const result = await adapter.requestService({
    serviceId,
    params: { prompt: "Hello from IVXP quickstart" },
  });

  console.log("Transaction complete!");
  console.log("Order ID:", result.orderId);
  console.log("Deliverable:", result.deliverable);
}

main().catch(console.error);
```

Run it:

```bash
npx tsx quickstart.ts
```

---

## Step 4: Verify the Output

A successful run prints:

```
Services available: [ 'text-generation', ... ]
Transaction complete!
Order ID: <uuid>
Deliverable: { format: 'text', content: '...' }
```

If you see an error:

| Error | Likely cause |
|-------|-------------|
| `InsufficientBalanceError` | Wallet has no test USDC — visit the faucet |
| `ServiceUnavailableError` | Provider URL is unreachable — check `IVXP_PROVIDER_URL` |
| `SignatureVerificationError` | Private key is malformed — must be `0x` + 64 hex chars |
| `PaymentFailedError` | RPC endpoint issue — try a different provider URL |

---

## Next Steps

- **Build your own adapter**: [Adapter Development Guide](../adapter-development-guide.md)
- **Validate your implementation**: [Conformance Checklist](./conformance-checklist.md)
- **Explore a reference implementation**: [Reference Adapter Repository](./reference-adapter-repo.md)
- **Run cross-framework interop tests**: see the interop test suite in `packages/adapter-a2a/tests/`
