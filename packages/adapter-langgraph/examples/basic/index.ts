/**
 * @ivxp/adapter-langgraph — Basic End-to-End Example
 *
 * Demonstrates the full IVXP flow (catalog -> quote -> pay -> deliver -> download)
 * using ivxpNode inside a LangGraph StateGraph.
 *
 * Usage:
 *   IVXP_PRIVATE_KEY=0x... IVXP_PROVIDER_URL=http://... npx tsx index.ts
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import { ivxpNode } from "@ivxp/adapter-langgraph";
import type { IVXPLangGraphState } from "@ivxp/adapter-langgraph";

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
const network = process.env.IVXP_NETWORK ?? "base-sepolia";

// ---------------------------------------------------------------------------
// State channel definitions for LangGraph
// ---------------------------------------------------------------------------

const stateChannels = {
  providerUrl: { value: (_a: string, b: string) => b },
  serviceType: { value: (_a: string, b: string) => b },
  input: {
    value: (_a: Record<string, unknown>, b: Record<string, unknown>) => b,
  },
  budgetUsdc: { value: (_a: number, b: number) => b },
  ivxpResult: {
    value: (_a: unknown, b: unknown) => b,
    default: () => undefined,
  },
  ivxpError: {
    value: (_a: string | undefined, b: string | undefined) => b,
    default: () => undefined,
  },
  pollOptions: {
    value: (_a: unknown, b: unknown) => b,
    default: () => undefined,
  },
};

// ---------------------------------------------------------------------------
// Build and compile the graph
// ---------------------------------------------------------------------------

const graph = new StateGraph<IVXPLangGraphState>({ channels: stateChannels })
  .addNode("callIVXP", ivxpNode)
  .addEdge(START, "callIVXP")
  .addEdge("callIVXP", END)
  .compile();

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("Starting IVXP LangGraph workflow...");
  console.log(`Provider: ${providerUrl}`);
  console.log(`Network:  ${network}`);

  const initialState: IVXPLangGraphState = {
    providerUrl,
    serviceType: "echo", // Must match a service registered in the provider's catalog
    input: { message: "Hello from LangGraph!" },
    budgetUsdc: 0.01,
  };

  const finalState = await graph.invoke(initialState);

  if (!finalState.ivxpResult) {
    console.error("Workflow failed: no result returned");
    if (finalState.ivxpError) {
      console.error("Error:", finalState.ivxpError);
    }
    process.exit(1);
  }

  console.log("\nWorkflow completed successfully.");
  console.log("Order ID:     ", finalState.ivxpResult.orderId);
  console.log("Content Hash: ", finalState.ivxpResult.contentHash);
  console.log("Result:       ", JSON.stringify(finalState.ivxpResult.result, null, 2));
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error("Workflow failed:", message);
  process.exit(1);
});
