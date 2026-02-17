# Quick Start: Provider

This guide walks you through hosting an IVXP service provider in under 5 minutes.

## Minimal Provider

```typescript
import { createIVXPProvider } from '@ivxp/sdk';

const provider = createIVXPProvider({
  privateKey: process.env.PROVIDER_PRIVATE_KEY as `0x${string}`,
  network: 'base-sepolia',
  services: [
    {
      type: 'text_echo',
      description: 'Echoes back the input text',
      base_price_usdc: 0.10,
      estimated_delivery_hours: 0.01,
    },
  ],
});

// Register a handler for the service
provider.registerServiceHandler('text_echo', async (order) => {
  return {
    content: `Echo: ${order.serviceType} order ${order.orderId} processed`,
    content_type: 'text/plain',
  };
});

// Start the HTTP server
const { port, host } = await provider.start();
console.log(`Provider listening on http://${host}:${port}`);
console.log(`Catalog: http://${host}:${port}/ivxp/catalog`);
```

## Provider Endpoints

Once started, the provider serves these HTTP endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/ivxp/catalog` | Service catalog with pricing |
| POST | `/ivxp/request` | Request a service quote |
| POST | `/ivxp/deliver` | Submit payment and request delivery |
| GET | `/ivxp/status/{order_id}` | Check order status |
| GET | `/ivxp/download/{order_id}` | Download deliverable |

## Service Handler

Service handlers are async functions that process orders and return deliverables:

```typescript
import type { StoredOrder } from '@ivxp/protocol';

provider.registerServiceHandler('code_review', async (order: StoredOrder) => {
  // Your service logic here
  const analysis = await performCodeReview(order);

  return {
    content: JSON.stringify(analysis),
    content_type: 'application/json',
  };
});
```

The handler receives a `StoredOrder` with:
- `orderId` -- Unique order identifier
- `serviceType` -- The requested service type
- `clientAddress` -- Client's wallet address
- `priceUsdc` -- Agreed price
- `status` -- Current order status ("paid")

## Configuration Options

```typescript
const provider = createIVXPProvider({
  privateKey: '0x...',
  services: [/* ... */],

  // Network (default: 'base-sepolia')
  network: 'base-sepolia',

  // Server binding (default: 127.0.0.1:3001)
  port: 3001,
  host: '127.0.0.1',

  // Display name in catalog
  providerName: 'My AI Service',

  // Custom order storage (default: in-memory)
  // orderStore: new SQLiteOrderStore(),

  // Allow localhost delivery URLs (dev only)
  allowPrivateDeliveryUrls: false,
});
```

## Graceful Shutdown

```typescript
// Stop accepting new connections
await provider.stop();
```

## Next Steps

- [Provider Guide](../guides/provider-guide.md) -- Detailed provider walkthrough
- [Payment Guide](../guides/payment-guide.md) -- Payment verification details
- [Signature Guide](../guides/signature-guide.md) -- EIP-191 signature handling
