/**
 * A2A Provider Example
 *
 * Starts an IVXPProvider HTTP server with a `text_echo` service.
 * The provider handles the full IVXP protocol over HTTP directly.
 *
 * Required env vars:
 *   IVXP_PRIVATE_KEY  - 0x-prefixed 64-char hex private key
 *   IVXP_NETWORK      - "base-sepolia" (default) or "base-mainnet"
 */

import { IVXPProvider, type NetworkType } from "@ivxp/sdk";

/** Regex for a valid 0x-prefixed 32-byte hex private key (66 chars total). */
const PRIVATE_KEY_REGEX = /^0x[0-9a-fA-F]{64}$/;

function loadProviderEnv(): {
  readonly privateKey: `0x${string}`;
  readonly network: NetworkType;
} {
  const privateKey = process.env.IVXP_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error(
      "IVXP_PRIVATE_KEY env var is required. " + "Set a 0x-prefixed 64-char hex private key.",
    );
  }
  if (!PRIVATE_KEY_REGEX.test(privateKey)) {
    throw new Error("IVXP_PRIVATE_KEY must be a 0x-prefixed 64-char hex string (32 bytes)");
  }

  const network = (process.env.IVXP_NETWORK ?? "base-sepolia") as NetworkType;
  return { privateKey: privateKey as `0x${string}`, network };
}

export interface ExampleProviderResult {
  readonly url: string;
  readonly port: number;
  readonly stop: () => Promise<void>;
}

/**
 * Start an example IVXP provider with a text_echo service.
 *
 * The provider listens on a random available port (port: 0)
 * and returns the URL and a stop function.
 */
export async function startExampleProvider(): Promise<ExampleProviderResult> {
  const { privateKey, network } = loadProviderEnv();

  const provider = new IVXPProvider({
    privateKey,
    network,
    port: 0,
    providerName: "A2A Example Provider",
    services: [{ type: "text_echo", base_price_usdc: 1, estimated_delivery_hours: 0.01 }],
    serviceHandlers: new Map([
      [
        "text_echo",
        async () => ({
          content: "Echo: Hello from the A2A example provider!",
          content_type: "text/plain" as const,
        }),
      ],
    ]),
  });

  const { port, host } = await provider.start();
  const url = `http://${host}:${port}`;

  console.log(`[provider] Listening at ${url}`);

  return {
    url,
    port,
    stop: () => provider.stop(),
  };
}
