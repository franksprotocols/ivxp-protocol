---
title: SDK Provider Guide
description: Provider-side architecture and implementation guidance using @ivxp/sdk.
---

Use this guide when you implement provider services directly with `@ivxp/sdk`.

## Create a Provider

```typescript
import { createIVXPProvider } from "@ivxp/sdk";

const provider = createIVXPProvider({
  privateKey: process.env.PROVIDER_PRIVATE_KEY as `0x${string}`,
  network: "base-sepolia",
  providerName: "My AI Services",
  host: "127.0.0.1",
  port: 3001,
  services: [
    {
      type: "code_review",
      description: "AI-powered code review",
      base_price_usdc: 5,
      estimated_delivery_hours: 1,
    },
  ],
});
```

## Configuration Reference

| Option                     | Type                  | Default                    | Description                          |
| -------------------------- | --------------------- | -------------------------- | ------------------------------------ |
| `privateKey`               | `0x${string}`         | required                   | Provider wallet private key          |
| `services`                 | `ServiceDefinition[]` | required                   | Services offered                     |
| `network`                  | `NetworkType`         | `base-sepolia`             | Base network                         |
| `port`                     | `number`              | `3001`                     | HTTP port                            |
| `host`                     | `string`              | `127.0.0.1`                | HTTP host                            |
| `providerName`             | `string`              | `IVXP Provider`            | Provider display name                |
| `orderStore`               | `IOrderStorage`       | `InMemoryOrderStore`       | Order persistence backend            |
| `deliverableStore`         | `IDeliverableStore`   | `InMemoryDeliverableStore` | Deliverable persistence backend      |
| `allowPrivateDeliveryUrls` | `boolean`             | `false`                    | Allow localhost/private push targets |

## Register Service Handlers

```typescript
provider.registerServiceHandler("code_review", async (order) => {
  const review = await performCodeReview(order);

  return {
    content: JSON.stringify(review, null, 2),
    content_type: "application/json",
  };
});
```

Handlers can return:

- text: `text/plain`
- JSON: `application/json`
- binary: `application/octet-stream`

## Server Lifecycle

```typescript
const { host, port } = await provider.start();
console.log(`Provider running at http://${host}:${port}`);

console.log("Running:", provider.isRunning());

await provider.stop();
```

## Processing Pipeline

When delivery is requested, provider flow is:

1. validate order exists and state is valid
2. verify on-chain payment
3. verify EIP-191 signature
4. mark order as `paid`
5. execute service handler asynchronously
6. compute `content_hash`
7. persist deliverable
8. update status to `delivered` or `delivery_failed`

## Programmatic Methods

```typescript
const catalog = await provider.getCatalog();
const quote = await provider.handleQuoteRequest(serviceRequest);
const accepted = await provider.handleDeliveryRequest(deliveryRequest);
const status = await provider.handleStatusRequest(orderId);
const download = await provider.handleDownloadRequest(orderId);
```

## Persistence Interfaces

Order persistence (`IOrderStorage`) should support create/get/update/list/delete.

Deliverable persistence (`IDeliverableStore`) should support get/set by `orderId`.

Use persistent backends for production workloads.

## Security Notes

- validate all external payloads via protocol schemas
- keep `allowPrivateDeliveryUrls` disabled unless explicitly needed in development
- never place private keys in source code

## Related References

- [Provider Quick Start](./quickstart.md)
- [Protocol Security](../protocol/security.md)
- [SDK Error Handling](../sdk/guides/error-handling.md)
