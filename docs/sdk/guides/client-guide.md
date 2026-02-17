# Client SDK Guide

This guide covers the full `IVXPClient` API for consuming IVXP services.

## Creating a Client

```typescript
import { createIVXPClient } from "@ivxp/sdk";

const client = createIVXPClient({
  privateKey: process.env.IVXP_PRIVATE_KEY as `0x${string}`,
  network: "base-sepolia", // or 'base-mainnet'
});
```

The `createIVXPClient` factory validates the private key format and returns a configured `IVXPClient` instance. The client internally initializes:

- **CryptoService** -- EIP-191 message signing and verification
- **PaymentService** -- USDC transfers on Base L2
- **HttpClient** -- HTTP communication with providers

## Client Properties

```typescript
// Get wallet address
const address = await client.getAddress();

// Get configured network
const network = client.getNetwork(); // 'base-sepolia' | 'base-mainnet'

// Get USDC balance
const balance = await client.getBalance(); // e.g. "100.500000"
```

## Service Discovery

### Fetch Catalog

```typescript
const providerUrl = process.env.IVXP_PROVIDER_URL ?? "http://localhost:3001";
const catalog = await client.getCatalog(providerUrl);

// catalog.provider     -- Provider name
// catalog.services     -- Array of ServiceDefinition
// catalog.walletAddress -- Provider's payment address

for (const service of catalog.services) {
  console.log(`${service.type}: ${service.base_price_usdc} USDC`);
  console.log(`  Delivery: ~${service.estimated_delivery_hours}h`);
}
```

## Request Flow

### 1. Request a Quote

```typescript
const quote = await client.requestQuote(providerUrl, {
  serviceType: "market-analysis",
  description: "Analyze USDC/ETH trading pair on Base",
  budgetUsdc: 10,
  deliveryFormat: "json", // optional: 'markdown' | 'json' | 'code'
  deadline: new Date("2026-03-01"), // optional: must be future
  contactEndpoint: "https://my-app.com/callback", // optional: for push delivery
});

// quote.orderId              -- Unique order ID
// quote.quote.priceUsdc      -- Quoted price
// quote.quote.paymentAddress -- Where to send USDC
// quote.quote.estimatedDelivery -- ISO 8601 estimated delivery time
```

### 2. Submit Payment

```typescript
const payment = await client.submitPayment(providerUrl, quote.orderId, {
  priceUsdc: quote.quote.priceUsdc,
  paymentAddress: quote.quote.paymentAddress as `0x${string}`,
});

// payment.orderId -- Order ID
// payment.txHash  -- On-chain transaction hash
// payment.status  -- 'paid'
```

The SDK:

1. Sends USDC on-chain to the provider's payment address
2. Signs an EIP-191 payment proof message
3. Notifies the provider with the signed proof

If payment succeeds but notification fails, a `PartialSuccessError` is thrown with the `txHash` for recovery.

### 3. Poll for Delivery

```typescript
// Wait for delivery (convenience)
const delivered = await client.waitForDelivery(providerUrl, quote.orderId);

// Or poll with custom target statuses
const status = await client.pollOrderUntil(providerUrl, quote.orderId, {
  targetStatuses: ["delivered", "delivery_failed"],
  maxAttempts: 30,
  initialDelay: 1000,
  maxDelay: 10000,
});
```

### 4. Download Deliverable

```typescript
const deliverable = await client.downloadDeliverable(
  providerUrl,
  quote.orderId,
  { savePath: "./output/result.json" }, // optional: save to file
);

// deliverable.deliverable.content    -- The content
// deliverable.deliverable.format     -- 'markdown' | 'json' | 'code'
// deliverable.deliverable.contentHash -- SHA-256 hash
```

### 5. Confirm Delivery

```typescript
const confirmation = await client.confirmDelivery(providerUrl, quote.orderId);

// confirmation.status      -- 'confirmed'
// confirmation.confirmedAt -- ISO 8601 timestamp
// confirmation.signature   -- EIP-191 confirmation signature
```

Confirmation is idempotent -- calling it again on an already-confirmed order returns success.

## One-Line Convenience Method

`requestService()` orchestrates the entire flow:

```typescript
const result = await client.requestService({
  providerUrl: process.env.IVXP_PROVIDER_URL ?? "http://localhost:3001",
  serviceType: "market-analysis",
  description: "Analyze USDC/ETH pair",
  budgetUsdc: 10,
  deliveryFormat: "json",
  timeoutMs: 120_000, // default: 2 minutes
  autoConfirm: true, // default: true
  pollOptions: {
    maxAttempts: 30,
    initialDelay: 1000,
  },
  onQuote: (quote) => console.log("Quoted:", quote.quote.priceUsdc),
  onPayment: (payment) => console.log("Paid:", payment.txHash),
  onDelivered: (delivery) => console.log("Delivered!"),
  onConfirmed: (confirm) => console.log("Confirmed:", confirm.confirmedAt),
});

// result.orderId        -- Order ID
// result.status         -- 'confirmed' or 'delivered'
// result.deliverable    -- Full delivery response
// result.quote          -- Original quote
// result.paymentTxHash  -- On-chain tx hash
// result.confirmedAt    -- Confirmation timestamp (if autoConfirm)
```

### Budget Guard

If the quoted price exceeds `budgetUsdc`, a `BudgetExceededError` is thrown **before** any on-chain transaction:

```typescript
try {
  await client.requestService({
    providerUrl: process.env.IVXP_PROVIDER_URL ?? "http://localhost:3001",
    serviceType: "expensive-service",
    description: "...",
    budgetUsdc: 5, // budget limit
  });
} catch (error) {
  if (error instanceof BudgetExceededError) {
    console.log("Quote exceeded budget:", error.quoteInfo.priceUsdc);
    // No USDC was spent
  }
}
```

## Callback Server (Push Delivery)

The client can start a callback server to receive push deliveries:

```typescript
// Start callback server
const server = await client.startCallbackServer({ port: 8080 });
console.log("Callback URL:", server.url);

// Listen for deliveries
client.on("delivery.received", ({ orderId, contentHash, format }) => {
  console.log(`Received delivery for ${orderId}`);
});

client.on("delivery.rejected", ({ orderId, reason }) => {
  console.log(`Rejected delivery for ${orderId}: ${reason}`);
});

// Include callback URL in service requests
const quote = await client.requestQuote(providerUrl, {
  serviceType: "text_echo",
  description: "Hello!",
  budgetUsdc: 1,
  contactEndpoint: client.getCallbackUrl(),
});

// Stop when done
await client.stopCallbackServer();
```

## Advanced: Service Accessors

Access underlying services for advanced use cases:

```typescript
// Direct crypto operations
const signature = await client.crypto.sign("custom message");
const valid = await client.crypto.verify(message, signature, address);

// Direct payment operations
const balance = await client.payment.getBalance(address);

// Direct HTTP operations
const response = await client.http.get<unknown>("https://api.example.com");
```

## Next Steps

- [Payment Guide](./payment-guide.md) -- USDC payment details
- [Events](./events.md) -- SDK event system
- [Error Handling](./error-handling.md) -- Error recovery patterns
