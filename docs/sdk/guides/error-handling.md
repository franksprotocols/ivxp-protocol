# Error Handling

All SDK errors extend `IVXPError`, which provides structured error information for programmatic handling.

## Error Hierarchy

```
Error
  └── IVXPError (base class)
        ├── InsufficientBalanceError
        ├── TransactionError
        ├── TransactionSubmissionError
        ├── PaymentNotFoundError
        ├── PaymentPendingError
        ├── PaymentFailedError
        ├── PaymentAmountMismatchError
        ├── SignatureVerificationError
        ├── PaymentVerificationError
        ├── OrderNotFoundError
        ├── OrderExpiredError
        ├── ServiceUnavailableError
        ├── MaxPollAttemptsError
        ├── PartialSuccessError
        ├── BudgetExceededError
        ├── TimeoutError
        └── ProviderError
```

## IVXPError Base Class

Every SDK error includes:

```typescript
import { IVXPError } from "@ivxp/sdk";

try {
  await client.requestQuote(providerUrl, params);
} catch (error) {
  if (error instanceof IVXPError) {
    console.log(error.message); // Human-readable description
    console.log(error.code); // Machine-readable code (e.g. 'INSUFFICIENT_BALANCE')
    console.log(error.details); // Optional structured data
    console.log(error.cause); // Original error (if wrapped)
    console.log(error.toJSON()); // Structured JSON for logging
  }
}
```

## Error Codes Reference

### Payment Errors

| Error Class                  | Code                            | Description                        |
| ---------------------------- | ------------------------------- | ---------------------------------- |
| `InsufficientBalanceError`   | `INSUFFICIENT_BALANCE`          | Wallet USDC balance too low        |
| `TransactionError`           | `TRANSACTION_FAILED`            | On-chain tx confirmed but reverted |
| `TransactionSubmissionError` | `TRANSACTION_SUBMISSION_FAILED` | TX rejected before inclusion       |

### Verification Errors

| Error Class                  | Code                      | Description                   |
| ---------------------------- | ------------------------- | ----------------------------- |
| `PaymentNotFoundError`       | `PAYMENT_NOT_FOUND`       | TX hash not found on-chain    |
| `PaymentPendingError`        | `PAYMENT_PENDING`         | TX not yet confirmed          |
| `PaymentFailedError`         | `PAYMENT_FAILED`          | TX confirmed but reverted     |
| `PaymentAmountMismatchError` | `PAYMENT_AMOUNT_MISMATCH` | Transfer amount mismatch      |
| `SignatureVerificationError` | `SIGNATURE_INVALID`       | EIP-191 signature invalid     |
| `PaymentVerificationError`   | `PAYMENT_NOT_VERIFIED`    | Payment could not be verified |

### Order Errors

| Error Class          | Code              | Description             |
| -------------------- | ----------------- | ----------------------- |
| `OrderNotFoundError` | `ORDER_NOT_FOUND` | Order ID does not exist |
| `OrderExpiredError`  | `ORDER_EXPIRED`   | Order TTL exceeded      |

### Network Errors

| Error Class               | Code                  | Description                      |
| ------------------------- | --------------------- | -------------------------------- |
| `ServiceUnavailableError` | `SERVICE_UNAVAILABLE` | Provider unreachable or 5xx      |
| `ProviderError`           | `PROVIDER_ERROR`      | Provider error with step context |

### Flow Errors

| Error Class            | Code                | Description                          |
| ---------------------- | ------------------- | ------------------------------------ |
| `MaxPollAttemptsError` | `MAX_POLL_ATTEMPTS` | Polling exceeded max attempts        |
| `BudgetExceededError`  | `BUDGET_EXCEEDED`   | Quote price exceeds budget           |
| `TimeoutError`         | `TIMEOUT`           | requestService flow timed out        |
| `PartialSuccessError`  | `PARTIAL_SUCCESS`   | Payment sent but notification failed |

## Common Error Patterns

### Catch by Error Class

```typescript
import {
  BudgetExceededError,
  PartialSuccessError,
  TimeoutError,
  ProviderError,
  IVXPError,
} from "@ivxp/sdk";

try {
  const result = await client.requestService(params);
} catch (error) {
  if (error instanceof BudgetExceededError) {
    // Quote too expensive -- no USDC spent
    console.log("Budget:", error.budgetUsdc);
    console.log("Quoted:", error.quoteInfo.priceUsdc);
  } else if (error instanceof PartialSuccessError) {
    // Payment sent but something failed after
    console.log("TX Hash:", error.txHash);
    console.log("Recoverable:", error.recoverable);
  } else if (error instanceof TimeoutError) {
    // Flow timed out
    console.log("Step:", error.step);
    console.log("Partial state:", error.partialState);
  } else if (error instanceof ProviderError) {
    // Provider unreachable or returned error
    console.log("Provider:", error.providerUrl);
    console.log("Step:", error.step);
  } else if (error instanceof IVXPError) {
    // Any other SDK error
    console.log("Code:", error.code);
    console.log("Details:", error.details);
  }
}
```

### Catch by Error Code

```typescript
try {
  await client.submitPayment(providerUrl, orderId, quote);
} catch (error) {
  if (error instanceof IVXPError) {
    switch (error.code) {
      case "INSUFFICIENT_BALANCE":
        console.log("Top up your wallet");
        break;
      case "PARTIAL_SUCCESS":
        console.log("Payment sent, retry notification");
        break;
      case "SERVICE_UNAVAILABLE":
        console.log("Provider is down, try later");
        break;
      default:
        console.log("Unexpected error:", error.code);
    }
  }
}
```

### Recovery from Partial Success

When payment succeeds but provider notification fails:

```typescript
try {
  await client.submitPayment(providerUrl, orderId, quote);
} catch (error) {
  if (error instanceof PartialSuccessError) {
    // The USDC was sent on-chain. Save the txHash for recovery.
    console.log("Payment TX:", error.txHash);

    // Option 1: Retry the notification manually
    // Option 2: Contact the provider with the txHash
    // Option 3: Wait and check order status later
    const status = await client.getOrderStatus(providerUrl, orderId);
  }
}
```

### Timeout Recovery

```typescript
try {
  await client.requestService({
    ...params,
    timeoutMs: 60_000,
  });
} catch (error) {
  if (error instanceof TimeoutError) {
    console.log("Timed out at step:", error.step);

    if (error.partialState.txHash) {
      // Payment was already sent
      console.log("Payment TX:", error.partialState.txHash);
      // Resume from polling step
    }
  }
}
```

## Structured Logging

Use `toJSON()` for structured logging:

```typescript
try {
  await client.requestService(params);
} catch (error) {
  if (error instanceof IVXPError) {
    console.error(JSON.stringify(error.toJSON(), null, 2));
    // {
    //   "name": "BudgetExceededError",
    //   "code": "BUDGET_EXCEEDED",
    //   "message": "Quote price 15 USDC exceeds budget 10 USDC",
    //   "details": { "orderId": "ivxp-abc", "priceUsdc": 15, "budgetUsdc": 10 },
    //   "stack": "...",
    //   "cause": null
    // }
  }
}
```

## Next Steps

- [Client Guide](./client-guide.md) -- Full client API
- [Payment Guide](./payment-guide.md) -- Payment error details
- [Events](./events.md) -- Event-based error monitoring
