/**
 * A2A Client Example
 *
 * Demonstrates the full IVXP flow through the A2A Client Adapter:
 *   getCatalog -> requestQuote -> requestDelivery -> getStatus -> download
 *
 * Required env vars:
 *   IVXP_PRIVATE_KEY  - 0x-prefixed 64-char hex private key
 *   IVXP_NETWORK      - "base-sepolia" (default) or "base-mainnet"
 */

import { IVXPA2AClientAdapter, buildNonce, buildSignedMessage } from "@ivxp/adapter-a2a";
import { createCryptoService, type NetworkType } from "@ivxp/sdk";
import type { PaymentProofOutput } from "@ivxp/protocol";

/** Regex for a valid 0x-prefixed 32-byte hex private key (66 chars total). */
const PRIVATE_KEY_REGEX = /^0x[0-9a-fA-F]{64}$/;

/** Fake tx hash used for the example (no real on-chain payment). */
const FAKE_TX_HASH = ("0x" + "ab".repeat(32)) as `0x${string}`;

function loadClientEnv(): {
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

/**
 * Run the full IVXP flow against a provider URL.
 *
 * Returns the deliverable content string on success.
 */
export async function runExampleClient(providerUrl: string): Promise<string> {
  const { privateKey, network } = loadClientEnv();

  const adapter = new IVXPA2AClientAdapter({ privateKey, network });
  const crypto = createCryptoService(privateKey);

  // Step 1: Get catalog
  const catalog = await adapter.getCatalog(providerUrl);
  const serviceTypes = catalog.services.map((s) => s.type);
  console.log("[client] Catalog services:", serviceTypes);

  // Step 2: Request quote
  const quote = await adapter.requestQuote(providerUrl, {
    serviceType: "text_echo",
    description: "A2A adapter end-to-end example",
    budgetUsdc: 5,
  });
  console.log(
    `[client] Quote received — orderId: ${quote.orderId}, price: ${quote.quote.priceUsdc} USDC`,
  );

  // Step 3: Build payment proof and request delivery
  // The timestamp embedded in signedMessage is validated for freshness by the
  // provider (must be within 300 s). It is separate from the envelope timestamp
  // that the adapter sets automatically on the delivery request body.
  const nonce = buildNonce();
  const timestamp = new Date().toISOString();
  const signedMessage = buildSignedMessage({
    orderId: quote.orderId,
    txHash: FAKE_TX_HASH,
    nonce,
    timestamp,
  });
  const signature = await crypto.sign(signedMessage);

  const paymentProof = {
    txHash: FAKE_TX_HASH,
    fromAddress: await crypto.getAddress(),
    network,
  } as PaymentProofOutput;

  const accepted = await adapter.requestDelivery(
    providerUrl,
    quote.orderId,
    paymentProof,
    signature,
    signedMessage,
  );
  console.log(`[client] Delivery accepted — orderId: ${accepted.orderId}`);

  // Step 4: Check status
  const status = await adapter.getStatus(providerUrl, quote.orderId);
  console.log(`[client] Order status: ${status.status}`);

  // Step 5: Download deliverable
  const delivery = await adapter.download(providerUrl, quote.orderId);
  const content =
    typeof delivery.deliverable.content === "string"
      ? delivery.deliverable.content
      : String(delivery.deliverable.content);
  console.log(`[client] Deliverable content: ${content}`);

  return content;
}
