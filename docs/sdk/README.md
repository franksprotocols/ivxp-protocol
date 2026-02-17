# IVXP SDK Documentation

> SDK Version: 0.1.0 | Last Updated: 2026-02-17

The `@ivxp/sdk` is a TypeScript SDK for the Intelligence Value Exchange Protocol (IVXP). It enables AI agents and applications to exchange intelligence services with cryptographic payment verification on Base L2.

## Quick Navigation

### Getting Started

- [Installation](./getting-started/installation.md) -- Install the SDK and peer dependencies
- [Environment Setup](./getting-started/environment-setup.md) -- Configure wallets and Base network
- [Quick Start: Client](./getting-started/quick-start-client.md) -- Request your first service
- [Quick Start: Provider](./getting-started/quick-start-provider.md) -- Host your first service

### Guides

- [Client Guide](./guides/client-guide.md) -- Detailed client SDK walkthrough
- [Provider Guide](./guides/provider-guide.md) -- Detailed provider SDK walkthrough
- [Payment Guide](./guides/payment-guide.md) -- USDC payment flows on Base L2
- [Signature Guide](./guides/signature-guide.md) -- EIP-191 cryptographic signatures
- [Events](./guides/events.md) -- SDK event system
- [Error Handling](./guides/error-handling.md) -- Error classes and recovery patterns

### API Reference

- [Generated API Docs](./api/) -- TypeDoc auto-generated reference

### Examples

- [Basic Client](./examples/basic-client.ts) -- Minimal client example
- [Basic Provider](./examples/basic-provider.ts) -- Minimal provider example
- [Event Handling](./examples/event-handling.ts) -- Working with SDK events
- [Error Recovery](./examples/error-recovery.ts) -- Handling errors gracefully

## Architecture Overview

```
Client App                          Provider Service
    |                                      |
    |  1. getCatalog()                     |
    |------------------------------------->|
    |  2. requestQuote()                   |
    |------------------------------------->|
    |  3. submitPayment() [USDC on-chain]  |
    |------------------------------------->|
    |  4. pollOrderUntil() / waitForDelivery()
    |------------------------------------->|
    |  5. downloadDeliverable()            |
    |------------------------------------->|
    |  6. confirmDelivery()                |
    |------------------------------------->|
```

Or use the one-line convenience method:

```typescript
const result = await client.requestService({
  providerUrl: process.env.IVXP_PROVIDER_URL ?? "http://localhost:3001",
  serviceType: "market-analysis",
  description: "Analyze USDC/ETH pair",
  budgetUsdc: 10,
});
```
