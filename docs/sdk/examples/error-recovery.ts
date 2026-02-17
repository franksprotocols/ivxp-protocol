/**
 * Error Recovery Example
 *
 * Demonstrates handling various SDK error types and
 * implementing recovery strategies.
 */

import {
  createIVXPClient,
  IVXPError,
  BudgetExceededError,
  PartialSuccessError,
  TimeoutError,
  ProviderError,
  ServiceUnavailableError,
  InsufficientBalanceError,
} from "@ivxp/sdk";

async function main(): Promise<void> {
  const privateKey = process.env.IVXP_PRIVATE_KEY as `0x${string}`;
  if (!privateKey) {
    throw new Error("IVXP_PRIVATE_KEY environment variable is required");
  }

  const client = createIVXPClient({
    privateKey,
    network: "base-sepolia",
  });

  const providerUrl = process.env.IVXP_PROVIDER_URL ?? "http://localhost:3001";

  try {
    const result = await client.requestService({
      providerUrl,
      serviceType: "text_echo",
      description: "Hello!",
      budgetUsdc: 1,
      timeoutMs: 60_000,
    });

    console.log("Success:", result.orderId);
  } catch (error) {
    if (error instanceof BudgetExceededError) {
      // Quote too expensive -- no USDC was spent
      console.error("Budget exceeded");
      console.error("  Budget:", error.budgetUsdc, "USDC");
      console.error("  Quoted:", error.quoteInfo.priceUsdc, "USDC");
      console.error("  Order:", error.quoteInfo.orderId);
    } else if (error instanceof PartialSuccessError) {
      // Payment sent but notification failed -- USDC was spent
      console.error("Partial success -- payment sent");
      console.error("  TX Hash:", error.txHash);
      console.error("  Recoverable:", error.recoverable);
      console.error("  Original error:", error.originalError?.message);
    } else if (error instanceof TimeoutError) {
      // Flow timed out -- check partial state
      console.error("Timeout at step:", error.step);
      if (error.partialState.txHash) {
        console.error("  Payment TX:", error.partialState.txHash);
      }
    } else if (error instanceof InsufficientBalanceError) {
      console.error("Insufficient USDC balance");
      console.error("  Available:", error.availableBalance);
      console.error("  Required:", error.requiredAmount);
    } else if (error instanceof ProviderError) {
      console.error("Provider error at step:", error.step);
      console.error("  Provider:", error.providerUrl);
    } else if (error instanceof ServiceUnavailableError) {
      console.error("Provider unreachable");
    } else if (error instanceof IVXPError) {
      // Generic SDK error
      console.error("SDK error:", error.code);
      console.error("  Message:", error.message);
      console.error("  Details:", error.details);
      // Structured logging
      console.error("  JSON:", JSON.stringify(error.toJSON(), null, 2));
    } else {
      console.error("Unexpected error:", error);
    }
  }
}

main().catch(console.error);
