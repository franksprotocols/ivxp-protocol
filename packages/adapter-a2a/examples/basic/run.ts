/**
 * A2A Adapter End-to-End Example — Orchestrator
 *
 * Starts a provider, runs the client against it, verifies the result,
 * then shuts down. Exits 0 on success, 1 on failure.
 *
 * Usage:
 *   IVXP_PRIVATE_KEY=0x... npx tsx examples/basic/run.ts
 */

import { startExampleProvider } from "./provider.js";
import { runExampleClient } from "./client.js";

async function main(): Promise<void> {
  console.log("[run] Starting A2A adapter end-to-end example...\n");

  const { url, stop } = await startExampleProvider();

  try {
    const content = await runExampleClient(url);

    if (!content || content.trim().length === 0) {
      throw new Error("Empty deliverable — example failed");
    }

    if (!content.includes("Echo:")) {
      throw new Error(`Unexpected deliverable content: ${content}`);
    }

    console.log("\n[run] SUCCESS — full flow completed");
  } finally {
    await stop();
    console.log("[run] Provider stopped");
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\n[run] FAILED: ${message}`);
  process.exit(1);
});
