/**
 * Event Handling Example
 *
 * Demonstrates subscribing to SDK events for monitoring
 * the service request lifecycle.
 */

import { createIVXPClient, EventEmitter } from "@ivxp/sdk";

async function main(): Promise<void> {
  const privateKey = process.env.IVXP_PRIVATE_KEY as `0x${string}`;
  if (!privateKey) {
    throw new Error("IVXP_PRIVATE_KEY environment variable is required");
  }

  const client = createIVXPClient({
    privateKey,
    network: "base-sepolia",
  });

  // Subscribe to all lifecycle events
  client.on("catalog.received", ({ provider, servicesCount }) => {
    console.log(`[catalog] ${provider}: ${servicesCount} services`);
  });

  client.on("order.quoted", ({ orderId, priceUsdc }) => {
    console.log(`[quoted] ${orderId}: ${priceUsdc} USDC`);
  });

  client.on("payment.sent", ({ txHash }) => {
    console.log(`[payment] TX: ${txHash}`);
  });

  client.on("order.paid", ({ orderId, txHash }) => {
    console.log(`[paid] ${orderId}: ${txHash}`);
  });

  client.on("order.status_changed", ({ orderId, previousStatus, newStatus }) => {
    console.log(`[status] ${orderId}: ${previousStatus ?? "null"} -> ${newStatus}`);
  });

  client.on("order.delivered", ({ orderId, format }) => {
    console.log(`[delivered] ${orderId}: ${format}`);
  });

  client.on("order.confirmed", ({ orderId, confirmedAt }) => {
    console.log(`[confirmed] ${orderId}: ${confirmedAt}`);
  });

  // Unsubscribe example
  const tempHandler = ({ orderId }: { orderId: string; txHash: string }) => {
    console.log("[temp] Paid:", orderId);
  };
  client.on("order.paid", tempHandler);
  client.off("order.paid", tempHandler); // removed immediately

  // Custom EventEmitter usage
  type AppEvents = {
    "app.ready": { version: string };
    "app.error": { message: string };
  };

  const appEmitter = new EventEmitter<AppEvents>();
  appEmitter.on("app.ready", ({ version }) => {
    console.log(`App v${version} ready`);
  });
  appEmitter.emit("app.ready", { version: "1.0.0" });

  console.log("Event handlers registered. Ready for service calls.");
}

main().catch(console.error);
