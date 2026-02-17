# IVXP/1.0 Error Codes

This document defines all error codes used in the IVXP/1.0 protocol. Error codes use `SCREAMING_SNAKE_CASE` convention.

## Error Response Format

All error responses follow this structure:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error description",
  "details": {
    "additional": "context"
  }
}
```

| Field     | Type            | Required | Description            |
| --------- | --------------- | -------- | ---------------------- |
| `error`   | `IVXPErrorCode` | Yes      | Error code constant    |
| `message` | `string`        | Yes      | Human-readable message |
| `details` | `object`        | No       | Additional context     |

---

## Client Errors

These errors indicate problems with the client's request.

| Code                           | HTTP Status | Description                                                  | Recovery                                      |
| ------------------------------ | ----------- | ------------------------------------------------------------ | --------------------------------------------- |
| `SIGNATURE_INVALID`            | 401         | EIP-191 signature verification failed                        | Re-sign with the correct private key          |
| `ORDER_NOT_FOUND`              | 404         | The specified order ID does not exist                        | Verify the order_id from the quote            |
| `ORDER_EXPIRED`                | 410         | The order's payment timeout has elapsed                      | Create a new service request                  |
| `SERVICE_TYPE_NOT_SUPPORTED`   | 400         | The requested service type is not in the catalog             | Check `GET /ivxp/catalog` for available types |
| `BUDGET_TOO_LOW`               | 400         | The budget is below the service's base price                 | Increase `budget_usdc` to meet the price      |
| `PROTOCOL_VERSION_UNSUPPORTED` | 400         | The protocol version is not supported                        | Use `"IVXP/1.0"`                              |
| `INVALID_TIMESTAMP`            | 400         | Message timestamp is too old or too far in the future        | Synchronize clock and retry                   |
| `DUPLICATE_DELIVERY_REQUEST`   | 409         | A delivery request for this order has already been processed | Check order status instead                    |
| `INVALID_ORDER_STATE`          | 409         | The order is not in the expected state for this operation    | Check order status and retry when appropriate |

### Example: Invalid Signature

```json
{
  "error": "SIGNATURE_INVALID",
  "message": "EIP-191 signature verification failed: recovered address does not match from_address",
  "details": {
    "expected_address": "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    "recovered_address": "0x1111111111111111111111111111111111111111"
  }
}
```

### Example: Service Type Not Supported

```json
{
  "error": "SERVICE_TYPE_NOT_SUPPORTED",
  "message": "Service type 'quantum_computing' is not offered by this provider",
  "details": {
    "requested_type": "quantum_computing",
    "available_types": ["code_review", "translation"]
  }
}
```

---

## Payment Errors

These errors relate to on-chain payment verification.

| Code                     | HTTP Status | Description                                        | Recovery                                      |
| ------------------------ | ----------- | -------------------------------------------------- | --------------------------------------------- |
| `PAYMENT_NOT_VERIFIED`   | 402         | On-chain transaction not found or invalid          | Verify tx_hash, check amount and recipient    |
| `INSUFFICIENT_BALANCE`   | 402         | Client's USDC balance is insufficient              | Fund the wallet with sufficient USDC          |
| `PAYMENT_TIMEOUT`        | 408         | Payment was not received within the timeout period | Create a new service request                  |
| `INVALID_NETWORK`        | 400         | The specified network is not supported             | Use `base-mainnet` or `base-sepolia`          |
| `INVALID_TOKEN_CONTRACT` | 400         | The token contract address does not match USDC     | Use the correct USDC contract for the network |
| `AMOUNT_MISMATCH`        | 402         | Payment amount does not match the quoted price     | Send the exact quoted amount or more          |

### Example: Payment Not Verified

```json
{
  "error": "PAYMENT_NOT_VERIFIED",
  "message": "Transaction 0xabc...def could not be verified on base-sepolia",
  "details": {
    "tx_hash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    "reason": "Transaction not found on chain",
    "network": "base-sepolia"
  }
}
```

### Example: Insufficient Balance

```json
{
  "error": "INSUFFICIENT_BALANCE",
  "message": "Insufficient USDC balance for the quoted amount",
  "details": {
    "required_usdc": 5.0,
    "available_usdc": 2.5
  }
}
```

---

## Server Errors

These errors indicate problems on the provider side.

| Code                  | HTTP Status | Description                                   | Recovery                      |
| --------------------- | ----------- | --------------------------------------------- | ----------------------------- |
| `SERVICE_UNAVAILABLE` | 503         | Provider cannot process requests at this time | Retry after a delay           |
| `INTERNAL_ERROR`      | 500         | An unexpected error occurred on the provider  | Contact the provider or retry |

### Example: Service Unavailable

```json
{
  "error": "SERVICE_UNAVAILABLE",
  "message": "Provider is currently at capacity. Please try again later.",
  "details": {
    "retry_after_seconds": 300
  }
}
```

### Example: Internal Error

```json
{
  "error": "INTERNAL_ERROR",
  "message": "An unexpected error occurred while processing your request",
  "details": {}
}
```

---

## Error Code Reference

Complete list of all IVXP/1.0 error codes:

| Code                           | Category | HTTP | Description                               |
| ------------------------------ | -------- | ---- | ----------------------------------------- |
| `PAYMENT_NOT_VERIFIED`         | Payment  | 402  | On-chain transaction not found or invalid |
| `SIGNATURE_INVALID`            | Client   | 401  | EIP-191 signature verification failed     |
| `ORDER_NOT_FOUND`              | Client   | 404  | Order ID not found                        |
| `SERVICE_UNAVAILABLE`          | Server   | 503  | Provider cannot process requests          |
| `INSUFFICIENT_BALANCE`         | Payment  | 402  | Insufficient USDC balance                 |
| `SERVICE_TYPE_NOT_SUPPORTED`   | Client   | 400  | Service type not in catalog               |
| `BUDGET_TOO_LOW`               | Client   | 400  | Budget below service price                |
| `PAYMENT_TIMEOUT`              | Payment  | 408  | Payment not received in time              |
| `ORDER_EXPIRED`                | Client   | 410  | Order TTL exceeded                        |
| `PROTOCOL_VERSION_UNSUPPORTED` | Client   | 400  | Unsupported protocol version              |
| `INTERNAL_ERROR`               | Server   | 500  | Unexpected provider error                 |
| `INVALID_TIMESTAMP`            | Client   | 400  | Timestamp too old or in the future        |
| `DUPLICATE_DELIVERY_REQUEST`   | Client   | 409  | Delivery already requested for this order |
| `INVALID_NETWORK`              | Payment  | 400  | Unsupported blockchain network            |
| `INVALID_TOKEN_CONTRACT`       | Payment  | 400  | Token contract is not USDC                |
| `AMOUNT_MISMATCH`              | Payment  | 402  | Payment amount does not match quote       |
| `INVALID_ORDER_STATE`          | Client   | 409  | Order not in expected state               |

---

## HTTP Status Code Mapping

| HTTP Status | IVXP Error Codes                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 400         | `SERVICE_TYPE_NOT_SUPPORTED`, `BUDGET_TOO_LOW`, `PROTOCOL_VERSION_UNSUPPORTED`, `INVALID_TIMESTAMP`, `INVALID_NETWORK`, `INVALID_TOKEN_CONTRACT` |
| 401         | `SIGNATURE_INVALID`                                                                                                                              |
| 402         | `PAYMENT_NOT_VERIFIED`, `INSUFFICIENT_BALANCE`, `AMOUNT_MISMATCH`                                                                                |
| 404         | `ORDER_NOT_FOUND`                                                                                                                                |
| 408         | `PAYMENT_TIMEOUT`                                                                                                                                |
| 409         | `DUPLICATE_DELIVERY_REQUEST`, `INVALID_ORDER_STATE`                                                                                              |
| 410         | `ORDER_EXPIRED`                                                                                                                                  |
| 500         | `INTERNAL_ERROR`                                                                                                                                 |
| 503         | `SERVICE_UNAVAILABLE`                                                                                                                            |
