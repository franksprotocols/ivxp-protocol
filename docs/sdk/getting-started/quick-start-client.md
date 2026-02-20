---
title: Quick Start Client
---

# Quick Start: Client

This guide walks you through requesting a service from an IVXP provider in under 5 minutes.

## Hello World: One-Line Service Call

The simplest way to use the SDK is the `requestService()` convenience method, which handles the entire flow (quote, pay, poll, download, confirm) in a single call:

```typescript
import { createIVXPClient } from "@ivxp/sdk";

const client = createIVXPClient({
  privateKey: process.env.IVXP_PRIVATE_KEY as `0x${string}`,
  network: "base-sepolia",
});

console.log("Client address:", await client.getAddress());
console.log("Network:", client.getNetwork());

// One-line service call
const result = await client.requestService({
  providerUrl: process.env.IVXP_PROVIDER_URL ?? "http://localhost:3001",
  serviceType: "text_echo",
  description: "Echo back my message: Hello IVXP!",
  budgetUsdc: 1,
});

console.log("Order ID:", result.orderId);
console.log("Status:", result.status);
console.log("Deliverable:", result.deliverable);
console.log("Payment TX:", result.paymentTxHash);
```

## Step-by-Step Flow

For more control, use the individual methods:

### 1. Browse the Service Catalog

```typescript
const providerUrl = process.env.IVXP_PROVIDER_URL ?? "http://localhost:3001";
const catalog = await client.getCatalog(providerUrl);

console.log("Provider:", catalog.provider);
for (const service of catalog.services) {
  console.log(`  ${service.type}: ${service.base_price_usdc} USDC`);
}
```

### 2. Request a Quote

```typescript
const quote = await client.requestQuote(providerUrl, {
  serviceType: "text_echo",
  description: "Echo back: Hello IVXP!",
  budgetUsdc: 1,
});

console.log("Order ID:", quote.orderId);
console.log("Price:", quote.quote.priceUsdc, "USDC");
console.log("Payment address:", quote.quote.paymentAddress);
```

### 3. Submit Payment

```typescript
const payment = await client.submitPayment(providerUrl, quote.orderId, {
  priceUsdc: quote.quote.priceUsdc,
  paymentAddress: quote.quote.paymentAddress as `0x${string}`,
});

console.log("TX Hash:", payment.txHash);
```

### 4. Wait for Delivery

```typescript
const delivered = await client.waitForDelivery(providerUrl, quote.orderId);

console.log("Status:", delivered.status);
```

### 5. Download the Deliverable

```typescript
const deliverable = await client.downloadDeliverable(providerUrl, quote.orderId);

console.log("Content:", deliverable.deliverable.content);
console.log("Format:", deliverable.deliverable.format);
```

### 6. Confirm Delivery

```typescript
const confirmation = await client.confirmDelivery(providerUrl, quote.orderId);

console.log("Confirmed at:", confirmation.confirmedAt);
```

## Progress Callbacks

The `requestService()` method supports progress callbacks for UI feedback:

```typescript
const result = await client.requestService({
  providerUrl: process.env.IVXP_PROVIDER_URL ?? "http://localhost:3001",
  serviceType: "text_echo",
  description: "Hello IVXP!",
  budgetUsdc: 1,
  onQuote: (quote) => console.log("Quote received:", quote.orderId),
  onPayment: (payment) => console.log("Payment sent:", payment.txHash),
  onDelivered: (delivery) => console.log("Delivered!"),
  onConfirmed: (confirm) => console.log("Confirmed at:", confirm.confirmedAt),
});
```

## Next Steps

- [Client Guide](../guides/client-guide.md) -- Detailed client walkthrough
- [Error Handling](../guides/error-handling.md) -- Handle errors gracefully
- [Events](../guides/events.md) -- Subscribe to SDK events
