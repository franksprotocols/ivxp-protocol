# @ivxp/adapter-langgraph -- Basic Example

Demonstrates the full IVXP flow (`catalog -> quote -> payment -> deliver -> download`) using `ivxpNode` inside a LangGraph `StateGraph`.

## Prerequisites

From the monorepo root:

```bash
pnpm install
pnpm --filter @ivxp/adapter-langgraph build
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `IVXP_PRIVATE_KEY` | Yes | 0x-prefixed 64-char hex private key (32 bytes) |
| `IVXP_PROVIDER_URL` | Yes | Provider base URL (e.g. `http://localhost:3001`) |
| `IVXP_NETWORK` | No | `base-sepolia` (default) or `base-mainnet` |

## Run

> This example is designed to run within the monorepo. Run `pnpm install` at the repo root first, then build the adapter:
>
> ```bash
> pnpm --filter @ivxp/adapter-langgraph build
> ```

Via `pnpm start` (recommended):

```bash
IVXP_PRIVATE_KEY=0x... IVXP_PROVIDER_URL=http://localhost:3001 pnpm start
```

Or directly with `tsx`:

```bash
IVXP_PRIVATE_KEY=0x... IVXP_PROVIDER_URL=http://localhost:3001 npx tsx index.ts
```

## Minimal Workflow Snippet

```typescript
import { StateGraph, START, END } from "@langchain/langgraph";
import { ivxpNode } from "@ivxp/adapter-langgraph";
import type { IVXPLangGraphState } from "@ivxp/adapter-langgraph";

const stateChannels = {
  providerUrl:  { value: (_a: string, b: string) => b },
  serviceType:  { value: (_a: string, b: string) => b },
  input:        { value: (_a: Record<string, unknown>, b: Record<string, unknown>) => b },
  budgetUsdc:   { value: (_a: number, b: number) => b },
  ivxpResult:   { value: (_a: unknown, b: unknown) => b, default: () => undefined },
  ivxpError:    { value: (_a: string | undefined, b: string | undefined) => b, default: () => undefined },
  pollOptions:  { value: (_a: unknown, b: unknown) => b, default: () => undefined },
};

const graph = new StateGraph<IVXPLangGraphState>({ channels: stateChannels })
  .addNode("callIVXP", ivxpNode)
  .addEdge(START, "callIVXP")
  .addEdge("callIVXP", END)
  .compile();

const result = await graph.invoke({
  providerUrl: "http://localhost:3001",
  serviceType: "echo",
  input: { message: "Hello from LangGraph!" },
  budgetUsdc: 0.01,
});

console.log(result.ivxpResult);
```

## Expected Output

```
Starting IVXP LangGraph workflow...
Provider: http://localhost:3001

Workflow completed successfully.
Order ID:      <uuid>
Content Hash:  <sha256-hex>
Result:        { ... }
```
