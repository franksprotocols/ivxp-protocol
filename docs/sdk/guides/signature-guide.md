# Signature Guide

IVXP uses EIP-191 (`personal_sign`) for all cryptographic signatures. This guide covers signing, verification, and the IVXP message format.

## EIP-191 Overview

EIP-191 prepends `"\x19Ethereum Signed Message:\n" + len(message)` before hashing, preventing signed messages from being replayed as transactions.

## CryptoService

The SDK provides `CryptoService` for all signing operations:

```typescript
import { CryptoService, createCryptoService } from "@ivxp/sdk/crypto";

const crypto = createCryptoService("0x..." as `0x${string}`);
```

### Sign a Message

```typescript
const signature = await crypto.sign("Hello IVXP!");
// Returns: 0x-prefixed 65-byte hex signature
```

### Verify a Signature

```typescript
const isValid = await crypto.verify(
  "Hello IVXP!", // original message
  signature, // 0x-prefixed signature
  "0xAbC..." as `0x${string}`, // expected signer address
);
// Returns: true or false (never throws)
```

Verification is case-insensitive for addresses and returns `false` for any invalid input.

### Get Wallet Address

```typescript
const address = await crypto.getAddress();
// Returns: checksummed 0x-prefixed address
```

## IVXP Message Format

The protocol defines a standard message format for payment proofs:

```
Order: {order_id} | Payment: {tx_hash} | Timestamp: {ISO8601}
```

### Format a Message

```typescript
import { formatIVXPMessage } from "@ivxp/sdk/crypto";

const message = formatIVXPMessage({
  orderId: "ivxp-abc123",
  txHash: "0x1234...abcd",
  timestamp: "2026-02-17T12:00:00.000Z", // optional, defaults to now
});
// "Order: ivxp-abc123 | Payment: 0x1234...abcd | Timestamp: 2026-02-17T12:00:00.000Z"
```

### Sign an IVXP Message

```typescript
const { message, signature } = await crypto.signIVXPMessage({
  orderId: "ivxp-abc123",
  txHash: "0x1234...abcd",
});
```

### Verify an IVXP Message

```typescript
const result = await crypto.verifyIVXPMessage({
  signedMessage: message,
  signature: signature,
  expectedAddress: "0xAbC..." as `0x${string}`,
});

if (result.valid) {
  console.log("Order ID:", result.orderId);
  console.log("TX Hash:", result.txHash);
} else {
  console.log("Invalid signature");
}
```

The verification result is a discriminated union:

- `{ valid: true, orderId: string, txHash: string }` on success
- `{ valid: false }` on failure

## Delivery Confirmation Signatures

When confirming delivery, the client signs a confirmation message:

```
Confirm delivery: {order_id} | Timestamp: {ISO8601}
```

This is handled automatically by `client.confirmDelivery()`.

## Security Considerations

- Private keys are never transmitted over the network
- Signatures bind to specific order IDs to prevent replay attacks
- The provider verifies both payment and signature before processing
- Network mismatch (e.g., Sepolia signature for mainnet order) is rejected

## Next Steps

- [Payment Guide](./payment-guide.md) -- USDC payment flows
- [Error Handling](./error-handling.md) -- Signature verification errors
