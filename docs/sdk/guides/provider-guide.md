---
title: Provider Guide
---

# Provider SDK Guide

This guide covers the full `IVXPProvider` API for hosting IVXP services.

## Creating a Provider

```typescript
import { createIVXPProvider } from "@ivxp/sdk";

const provider = createIVXPProvider({
  privateKey: process.env.PROVIDER_PRIVATE_KEY as `0x${string}`,
  network: "base-sepolia",
  services: [
    {
      type: "code_review",
      description: "AI-powered code review",
      base_price_usdc: 5,
      estimated_delivery_hours: 1,
    },
    {
      type: "market_analysis",
      description: "Crypto market analysis",
      base_price_usdc: 10,
      estimated_delivery_hours: 2,
    },
  ],
  providerName: "My AI Services",
  port: 3001,
  host: "127.0.0.1",
});
```

## Configuration

| Option                     | Type                  | Default                    | Description                              |
| -------------------------- | --------------------- | -------------------------- | ---------------------------------------- |
| `privateKey`               | `0x${string}`         | required                   | Provider's wallet private key            |
| `services`                 | `ServiceDefinition[]` | required                   | Services offered (min 1)                 |
| `network`                  | `NetworkType`         | `'base-sepolia'`           | Base network                             |
| `port`                     | `number`              | `3001`                     | HTTP server port (0 = OS-assigned)       |
| `host`                     | `string`              | `'127.0.0.1'`              | HTTP server host                         |
| `providerName`             | `string`              | `'IVXP Provider'`          | Display name in catalog                  |
| `orderStore`               | `IOrderStorage`       | `InMemoryOrderStore`       | Order persistence backend                |
| `deliverableStore`         | `IDeliverableStore`   | `InMemoryDeliverableStore` | Deliverable storage                      |
| `allowPrivateDeliveryUrls` | `boolean`             | `false`                    | Allow localhost push delivery (dev only) |

## Service Handlers

Register handlers to process orders after payment verification:

```typescript
provider.registerServiceHandler("code_review", async (order) => {
  // order.orderId      -- Unique order ID
  // order.serviceType  -- 'code_review'
  // order.clientAddress -- Client's wallet address
  // order.priceUsdc    -- Agreed price

  const review = await performCodeReview(order);

  return {
    content: JSON.stringify(review, null, 2),
    content_type: "application/json",
  };
});
```

Handlers can return string or binary content:

```typescript
// String content
return { content: 'Analysis complete', content_type: 'text/plain' };

// JSON content
return { content: JSON.stringify(data), content_type: 'application/json' };

// Binary content
return { content: new Uint8Array([...]), content_type: 'application/octet-stream' };
```

## Server Lifecycle

```typescript
// Start the HTTP server
const { port, host } = await provider.start();
console.log(`Provider running at http://${host}:${port}`);

// Check if running
console.log("Running:", provider.isRunning());

// Stop gracefully
await provider.stop();
```

## Order Processing Pipeline

When a client submits payment, the provider:

1. Validates the order exists and is in "quoted" status
2. Verifies on-chain USDC payment via `PaymentService.verify()`
3. Verifies the EIP-191 signature via `CryptoService.verify()`
4. Transitions order to "paid" status
5. Invokes the registered service handler asynchronously
6. Handler produces deliverable content
7. Computes SHA-256 content hash
8. Stores the deliverable
9. If push delivery endpoint exists, POSTs the deliverable
10. Transitions to "delivered" (or "delivery_failed" on push error)

## Programmatic API

Use the provider's methods directly (without the HTTP server):

```typescript
// Get the service catalog
const catalog = await provider.getCatalog();

// Handle a quote request
const quote = await provider.handleQuoteRequest(serviceRequest);

// Handle a delivery request (with payment verification)
const accepted = await provider.handleDeliveryRequest(deliveryRequest);

// Check order status
const status = await provider.handleStatusRequest(orderId);

// Download a deliverable
const download = await provider.handleDownloadRequest(orderId);

// Look up an order
const order = await provider.getOrder(orderId);

// Look up a deliverable
const deliverable = provider.getDeliverable(orderId);
```

## Custom Storage

### Order Storage

Implement `IOrderStorage` for persistent order storage:

```typescript
interface IOrderStorage {
  create(order: Omit<StoredOrder, "createdAt" | "updatedAt">): Promise<StoredOrder>;
  get(orderId: string): Promise<StoredOrder | null>;
  update(orderId: string, updates: Partial<StoredOrder>): Promise<StoredOrder>;
  list(filter?: { status?: OrderStatus }): Promise<StoredOrder[]>;
  delete(orderId: string): Promise<void>;
}
```

### Deliverable Storage

Implement `IDeliverableStore` for persistent deliverable storage:

```typescript
interface IDeliverableStore {
  get(orderId: string): StoredDeliverable | undefined;
  set(orderId: string, deliverable: StoredDeliverable): void;
}
```

## Push Delivery (SSRF Protection)

When a client provides a `delivery_endpoint`, the provider POSTs the deliverable to that URL. For security, the provider validates delivery URLs:

- Only `http:` and `https:` schemes allowed
- Localhost and private IPs blocked by default
- Set `allowPrivateDeliveryUrls: true` for development only

## Provider Properties

```typescript
const address = await provider.getAddress(); // Wallet address
const network = provider.getNetwork(); // 'base-sepolia' | 'base-mainnet'
const port = provider.getPort(); // Configured port
const host = provider.getHost(); // Configured host
const running = provider.isRunning(); // Server status
```

## Next Steps

- [Payment Guide](./payment-guide.md) -- Payment verification details
- [Signature Guide](./signature-guide.md) -- EIP-191 signatures
- [Error Handling](./error-handling.md) -- Error classes
