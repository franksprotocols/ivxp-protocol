/**
 * ivxpNode -- LangGraph node function for the IVXP protocol.
 *
 * Orchestrates the full IVXP flow (catalog -> quote -> pay -> poll/SSE -> download)
 * within a single LangGraph node invocation. Errors are converted to plain Error
 * instances via toLangGraphError for LangGraph compatibility.
 *
 * Prefer `createIvxpNode(client)` for production use to avoid creating a new
 * IVXPClient on every invocation. The `ivxpNode` export is a convenience wrapper
 * that reads credentials from environment variables.
 */

import { createIVXPClient, type IVXPClient } from "@ivxp/sdk";
import { IVXPLangGraphClientAdapter } from "./client-adapter.js";
import { toLangGraphError } from "./errors.js";
import type { IVXPLangGraphState, IVXPLangGraphNodeOutput } from "./types.js";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const PRIVATE_KEY_REGEX = /^0x[0-9a-fA-F]{64}$/;

/**
 * Validate and return the IVXP_PRIVATE_KEY environment variable.
 * Throws a descriptive Error if missing or malformed.
 */
function resolvePrivateKey(): `0x${string}` {
  const key = process.env.IVXP_PRIVATE_KEY;
  if (!key) {
    throw new Error("[IVXP] Missing environment variable: IVXP_PRIVATE_KEY is required");
  }
  if (!PRIVATE_KEY_REGEX.test(key)) {
    throw new Error(
      "[IVXP] Invalid IVXP_PRIVATE_KEY: must be a 0x-prefixed 64-character hex string (32 bytes)",
    );
  }
  return key as `0x${string}`;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a LangGraph node function bound to a specific IVXPClient instance.
 *
 * Use this factory in production to share a single client across invocations,
 * avoiding repeated key parsing and connection setup.
 *
 * @param client - Pre-configured IVXPClient instance
 * @returns A LangGraph-compatible async node function
 */
export function createIvxpNode(
  client: IVXPClient,
): (state: IVXPLangGraphState) => Promise<Partial<IVXPLangGraphState>> {
  return async function ivxpNodeFn(
    state: IVXPLangGraphState,
  ): Promise<Partial<IVXPLangGraphState>> {
    const { providerUrl, serviceType, input, budgetUsdc, pollOptions } = state;
    const adapter = new IVXPLangGraphClientAdapter(client);

    try {
      // Step 1: Discover available services
      const catalog = await adapter.getCatalog(providerUrl);
      const serviceEntry = catalog.services.find((s) => s.type === serviceType);
      if (!serviceEntry) {
        throw new Error(`[IVXP] Service "${serviceType}" not found in catalog at ${providerUrl}`);
      }

      // Step 2: Request a quote
      const description =
        typeof input.description === "string" ? input.description : JSON.stringify(input);

      const quote = await adapter.requestQuote(providerUrl, {
        serviceType,
        description,
        budgetUsdc,
      });

      // Step 3: Budget guard -- reject before any on-chain transaction
      if (quote.quote.priceUsdc > budgetUsdc) {
        throw new Error(
          `[IVXP] Quote price ${quote.quote.priceUsdc} USDC exceeds budget ${budgetUsdc} USDC`,
        );
      }

      // Step 4: Pay on-chain (submitPayment handles tx + provider notification)
      const paymentResult = await client.submitPayment(providerUrl, quote.orderId, {
        priceUsdc: quote.quote.priceUsdc,
        paymentAddress: quote.quote.paymentAddress as `0x${string}`,
      });

      // Step 5: Wait for completion via SSE or polling
      if (paymentResult.streamUrl) {
        await waitViaSSE(client, paymentResult.streamUrl);
      } else {
        await waitViaPolling(adapter, providerUrl, quote.orderId, pollOptions);
      }

      // Step 6: Download deliverable
      const downloaded = await adapter.download(providerUrl, quote.orderId);

      const ivxpResult: IVXPLangGraphNodeOutput = {
        result: downloaded.deliverable.content,
        orderId: quote.orderId,
        contentHash: downloaded.contentHash ?? "",
      };

      return { ivxpResult };
    } catch (err) {
      throw toLangGraphError(err, "ivxpNode");
    }
  };
}

// ---------------------------------------------------------------------------
// Convenience export
// ---------------------------------------------------------------------------

/**
 * Convenience LangGraph node that reads credentials from environment variables.
 *
 * Validates IVXP_PRIVATE_KEY on every call. For repeated invocations, prefer
 * `createIvxpNode(client)` to share a single IVXPClient instance.
 *
 * Required env vars:
 * - IVXP_PRIVATE_KEY: 0x-prefixed 64-char hex private key
 * - IVXP_NETWORK (optional): "base-mainnet" | "base-sepolia" (default: "base-sepolia")
 */
export async function ivxpNode(state: IVXPLangGraphState): Promise<Partial<IVXPLangGraphState>> {
  const privateKey = resolvePrivateKey();
  const client = createIVXPClient({
    privateKey,
    network: process.env.IVXP_NETWORK as "base-mainnet" | "base-sepolia" | undefined,
  });
  return createIvxpNode(client)(state);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const DEFAULT_POLL_INTERVAL_MS = 2_000;
const DEFAULT_MAX_POLL_ATTEMPTS = 60;

/**
 * Wait for order completion via SSE streaming.
 * Delegates SSE parsing entirely to the SDK's subscribeToStream.
 * Fixes the race condition by tracking pending cleanup before disconnect fn arrives.
 */
async function waitViaSSE(client: IVXPClient, streamUrl: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let disconnectFn: (() => void) | undefined;
    let pendingDisconnect = false;

    const cleanup = () => {
      if (disconnectFn) {
        disconnectFn();
      } else {
        pendingDisconnect = true;
      }
    };

    client
      .subscribeToStream(streamUrl, {
        onCompleted: () => {
          cleanup();
          resolve();
        },
        onFailed: (data) => {
          cleanup();
          reject(new Error(`[IVXP] Delivery failed via SSE: ${JSON.stringify(data)}`));
        },
        onExhausted: (err) => {
          cleanup();
          reject(new Error(`[IVXP] SSE stream exhausted: ${err.message}`));
        },
      })
      .then((disconnect) => {
        disconnectFn = disconnect;
        if (pendingDisconnect) {
          disconnect();
        }
      })
      .catch((err) => {
        reject(err);
      });
  });
}

/**
 * Wait for order completion via polling adapter.getStatus().
 * Respects configurable maxAttempts and intervalMs from pollOptions.
 */
async function waitViaPolling(
  adapter: IVXPLangGraphClientAdapter,
  providerUrl: string,
  orderId: string,
  pollOptions?: { maxAttempts?: number; intervalMs?: number },
): Promise<void> {
  const maxAttempts = pollOptions?.maxAttempts ?? DEFAULT_MAX_POLL_ATTEMPTS;
  const intervalMs = pollOptions?.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = await adapter.getStatus(providerUrl, orderId);

    if (status.status === "delivered") {
      return;
    }

    if (status.status === "delivery_failed") {
      throw new Error(`[IVXP] Delivery failed for order ${orderId}`);
    }

    await delay(intervalMs);
  }

  throw new Error(`[IVXP] Polling timed out after ${maxAttempts} attempts for order ${orderId}`);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
