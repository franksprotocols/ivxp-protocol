# Events

The IVXP SDK includes a type-safe event system built on a lightweight `EventEmitter`. The `IVXPClient` extends `EventEmitter<SDKEventMap>` and emits events at each stage of the service flow.

## Available Events

| Event                  | Payload                                           | Emitted When                             |
| ---------------------- | ------------------------------------------------- | ---------------------------------------- |
| `catalog.received`     | `{ provider, servicesCount }`                     | Catalog fetched successfully             |
| `order.quoted`         | `{ orderId, priceUsdc }`                          | Quote received from provider             |
| `order.paid`           | `{ orderId, txHash }`                             | Payment confirmed by provider            |
| `order.status_changed` | `{ orderId, previousStatus, newStatus }`          | Order status changes during polling      |
| `order.delivered`      | `{ orderId, format }`                             | Deliverable downloaded                   |
| `order.confirmed`      | `{ orderId, confirmedAt }`                        | Delivery confirmed                       |
| `payment.sent`         | `{ txHash }`                                      | On-chain USDC transfer succeeded         |
| `delivery.received`    | `{ orderId, contentHash, format }`                | Push delivery received (callback server) |
| `delivery.rejected`    | `{ orderId, reason, expectedHash, computedHash }` | Push delivery rejected (hash mismatch)   |

## Subscribing to Events

```typescript
import { createIVXPClient } from "@ivxp/sdk";

const client = createIVXPClient({
  privateKey: "0x..." as `0x${string}`,
  network: "base-sepolia",
});

// Subscribe to events
client.on("order.quoted", ({ orderId, priceUsdc }) => {
  console.log(`Quote for ${orderId}: ${priceUsdc} USDC`);
});

client.on("order.paid", ({ orderId, txHash }) => {
  console.log(`Payment for ${orderId}: ${txHash}`);
});

client.on("order.delivered", ({ orderId, format }) => {
  console.log(`Delivered ${orderId} in ${format} format`);
});

client.on("order.status_changed", ({ orderId, previousStatus, newStatus }) => {
  console.log(`${orderId}: ${previousStatus} -> ${newStatus}`);
});
```

## Unsubscribing

```typescript
const handler = ({ orderId }: { orderId: string }) => {
  console.log("Delivered:", orderId);
};

// Subscribe
client.on("order.delivered", handler);

// Unsubscribe
client.off("order.delivered", handler);

// Remove all listeners for an event
client.removeAllListeners("order.delivered");

// Remove all listeners for all events
client.removeAllListeners();
```

## Type Safety

Events are fully typed via `SDKEventMap`. TypeScript will enforce correct payload types:

```typescript
import type { SDKEventName, SDKEventPayload } from "@ivxp/sdk";

// Type-safe event name
const eventName: SDKEventName = "order.paid";

// Type-safe payload extraction
type PaidPayload = SDKEventPayload<"order.paid">;
// => { readonly orderId: string; readonly txHash: string }
```

## Custom EventEmitter

You can use the `EventEmitter` class independently:

```typescript
import { EventEmitter } from "@ivxp/sdk";

type MyEvents = {
  "task.started": { taskId: string };
  "task.completed": { taskId: string; result: unknown };
};

const emitter = new EventEmitter<MyEvents>();

emitter.on("task.started", ({ taskId }) => {
  console.log("Started:", taskId);
});

emitter.emit("task.started", { taskId: "abc" });
```

## Error Isolation

Handler errors are caught and logged via `console.error`. A throwing handler does not prevent other handlers from executing or propagate to the emitting code:

```typescript
client.on("order.paid", () => {
  throw new Error("This will be caught and logged");
});

client.on("order.paid", ({ txHash }) => {
  // This handler still runs
  console.log("Payment:", txHash);
});
```

## Next Steps

- [Client Guide](./client-guide.md) -- Full client API
- [Error Handling](./error-handling.md) -- Error classes and recovery
