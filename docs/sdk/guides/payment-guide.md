# Payment Guide

IVXP uses USDC (ERC-20) on Base L2 for all payments. This guide covers the payment flow, verification, and error handling.

## Payment Flow Overview

```
Client                    Base L2                   Provider
  |                         |                         |
  |  1. USDC.transfer()     |                         |
  |------------------------>|                         |
  |  2. tx confirmed        |                         |
  |<------------------------|                         |
  |  3. POST payment proof  |                         |
  |-------------------------------------------------->|
  |                         |  4. verify tx on-chain  |
  |                         |<------------------------|
  |  5. order status: paid  |                         |
  |<--------------------------------------------------|
```

## Networks and Contract Addresses

| Network | Chain ID | USDC Contract |
|---------|----------|---------------|
| Base Mainnet | 8453 | Published in `USDC_CONTRACT_ADDRESSES` |
| Base Sepolia | 84532 | Published in `USDC_CONTRACT_ADDRESSES` |

Access contract addresses from the SDK:

```typescript
import { USDC_CONTRACT_ADDRESSES, USDC_DECIMALS } from '@ivxp/sdk';

console.log('USDC decimals:', USDC_DECIMALS); // 6
```

## Client: Sending Payment

### Automatic (via submitPayment)

```typescript
const payment = await client.submitPayment(providerUrl, orderId, {
  priceUsdc: quote.quote.priceUsdc,
  paymentAddress: quote.quote.paymentAddress as `0x${string}`,
});

console.log('TX Hash:', payment.txHash);
```

The SDK handles:
- USDC amount formatting (6 decimal places)
- On-chain transfer via `PaymentService.send()`
- EIP-191 signed payment proof creation
- Provider notification via HTTP POST

### Check Balance Before Payment

```typescript
const balance = await client.getBalance();
const price = quote.quote.priceUsdc;

if (parseFloat(balance) < price) {
  console.log(`Insufficient balance: ${balance} < ${price} USDC`);
}
```

## Provider: Verifying Payment

The provider automatically verifies payments in `handleDeliveryRequest()`:

1. Checks the transaction exists on-chain
2. Verifies the transfer amount matches the quoted price
3. Verifies the sender and recipient addresses
4. Validates the EIP-191 signature

### Manual Verification

```typescript
const isValid = await provider.payment.verify(txHash, {
  from: clientAddress,
  to: providerAddress,
  amount: priceUsdc,
});
```

## Payment Proof Format

The SDK creates a signed payment proof in IVXP/1.0 wire format:

```json
{
  "protocol": "IVXP/1.0",
  "message_type": "payment_proof",
  "timestamp": "2026-02-17T12:00:00.000Z",
  "order_id": "ivxp-abc123",
  "payment": {
    "tx_hash": "0x...",
    "amount_usdc": "10.000000",
    "network": "base-sepolia"
  },
  "signature": {
    "message": "Order: ivxp-abc123 | Payment: 0x... | Timestamp: ...",
    "sig": "0x...",
    "signer": "0x..."
  }
}
```

## Error Handling

### Payment Errors

| Error | Code | When |
|-------|------|------|
| `InsufficientBalanceError` | `INSUFFICIENT_BALANCE` | Wallet has insufficient USDC |
| `TransactionError` | `TRANSACTION_FAILED` | On-chain tx reverted |
| `TransactionSubmissionError` | `TRANSACTION_SUBMISSION_FAILED` | TX rejected by network |
| `PartialSuccessError` | `PARTIAL_SUCCESS` | Payment sent but notification failed |

### Verification Errors

| Error | Code | When |
|-------|------|------|
| `PaymentNotFoundError` | `PAYMENT_NOT_FOUND` | TX hash not found on-chain |
| `PaymentPendingError` | `PAYMENT_PENDING` | TX not yet confirmed |
| `PaymentFailedError` | `PAYMENT_FAILED` | TX confirmed but reverted |
| `PaymentAmountMismatchError` | `PAYMENT_AMOUNT_MISMATCH` | Amount doesn't match quote |

### Recovery from PartialSuccessError

```typescript
try {
  await client.submitPayment(providerUrl, orderId, quote);
} catch (error) {
  if (error instanceof PartialSuccessError) {
    console.log('Payment sent:', error.txHash);
    console.log('Recoverable:', error.recoverable);
    // Retry provider notification manually
  }
}
```

## Next Steps

- [Signature Guide](./signature-guide.md) -- EIP-191 signature details
- [Error Handling](./error-handling.md) -- Full error reference
