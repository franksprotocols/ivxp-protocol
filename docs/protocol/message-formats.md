---
title: Message Formats
---

# IVXP/1.0 Message Formats

This document defines all request and response message structures for the IVXP/1.0 protocol. All wire protocol fields use `snake_case` for Python compatibility.

## Common Types

| Type              | Format                               | Description                                 |
| ----------------- | ------------------------------------ | ------------------------------------------- |
| `ProtocolVersion` | `"IVXP/1.0"`                         | Protocol version identifier (literal)       |
| `HexAddress`      | `0x` + 40 hex chars                  | Ethereum address (checksummed or lowercase) |
| `HexSignature`    | `0x` + 130 hex chars                 | EIP-191 signature (65 bytes)                |
| `HexHash`         | `0x` + 64 hex chars                  | Transaction hash (32 bytes)                 |
| `NetworkId`       | `"base-mainnet"` or `"base-sepolia"` | Supported blockchain networks               |
| `DeliveryFormat`  | `"markdown"`, `"json"`, or `"code"`  | Delivery content formats                    |
| `ISOTimestamp`    | ISO 8601 string                      | e.g. `"2026-02-05T12:00:00Z"`               |

## Message Type Discriminators

Every IVXP message includes a `message_type` field for routing:

| Value                   | Direction          | Description                      |
| ----------------------- | ------------------ | -------------------------------- |
| `service_catalog`       | Provider -> Client | Service catalog listing          |
| `service_request`       | Client -> Provider | Service quote request            |
| `service_quote`         | Provider -> Client | Quote with pricing               |
| `delivery_request`      | Client -> Provider | Payment proof + delivery trigger |
| `service_delivery`      | Provider -> Client | Completed deliverable            |
| `delivery_confirmation` | Client -> Provider | Receipt confirmation (IVXP/1.1)  |

---

## 1. Service Catalog

**Endpoint:** `GET /ivxp/catalog`
**Direction:** Provider -> Client

### Response: `ServiceCatalog`

```json
{
  "protocol": "IVXP/1.0",
  "provider": "IVXP Demo Provider",
  "wallet_address": "0x1234567890abcdef1234567890abcdef12345678",
  "services": [
    {
      "type": "code_review",
      "base_price_usdc": 5.0,
      "estimated_delivery_hours": 2
    },
    {
      "type": "translation",
      "base_price_usdc": 3.0,
      "estimated_delivery_hours": 1
    }
  ],
  "message_type": "service_catalog",
  "timestamp": "2026-02-05T12:00:00Z"
}
```

| Field            | Type                  | Required | Description               |
| ---------------- | --------------------- | -------- | ------------------------- |
| `protocol`       | `ProtocolVersion`     | Yes      | Must be `"IVXP/1.0"`      |
| `provider`       | `string`              | Yes      | Provider name/identifier  |
| `wallet_address` | `HexAddress`          | Yes      | Provider's payment wallet |
| `services`       | `ServiceDefinition[]` | Yes      | Available services        |
| `message_type`   | `"service_catalog"`   | No       | Message discriminator     |
| `timestamp`      | `ISOTimestamp`        | No       | Catalog generation time   |

### `ServiceDefinition`

| Field                      | Type     | Required | Description               |
| -------------------------- | -------- | -------- | ------------------------- |
| `type`                     | `string` | Yes      | Service type identifier   |
| `base_price_usdc`          | `number` | Yes      | Base price in USDC (>= 0) |
| `estimated_delivery_hours` | `number` | Yes      | Estimated hours (> 0)     |

---

## 2. Service Request (Quote Request)

**Endpoint:** `POST /ivxp/request`
**Direction:** Client -> Provider

### Request: `ServiceRequest`

```json
{
  "protocol": "IVXP/1.0",
  "message_type": "service_request",
  "timestamp": "2026-02-05T12:01:00Z",
  "client_agent": {
    "name": "my-ai-agent",
    "wallet_address": "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    "contact_endpoint": "https://my-agent.example.com/ivxp/callback"
  },
  "service_request": {
    "type": "code_review",
    "description": "Review the authentication module for security issues",
    "budget_usdc": 10.0,
    "delivery_format": "markdown",
    "deadline": "2026-02-05T18:00:00Z"
  }
}
```

| Field             | Type                    | Required | Description           |
| ----------------- | ----------------------- | -------- | --------------------- |
| `protocol`        | `ProtocolVersion`       | Yes      | Must be `"IVXP/1.0"`  |
| `message_type`    | `"service_request"`     | Yes      | Message discriminator |
| `timestamp`       | `ISOTimestamp`          | Yes      | Request timestamp     |
| `client_agent`    | `ClientAgent`           | Yes      | Client identification |
| `service_request` | `ServiceRequestDetails` | Yes      | Service details       |

### `ClientAgent`

| Field              | Type           | Required | Description                |
| ------------------ | -------------- | -------- | -------------------------- |
| `name`             | `string`       | Yes      | Client agent name          |
| `wallet_address`   | `HexAddress`   | Yes      | Client's wallet address    |
| `contact_endpoint` | `string` (URL) | No       | P2P push delivery endpoint |

### `ServiceRequestDetails`

| Field             | Type             | Required | Description                       |
| ----------------- | ---------------- | -------- | --------------------------------- |
| `type`            | `string`         | Yes      | Service type (must match catalog) |
| `description`     | `string`         | Yes      | Requirement description           |
| `budget_usdc`     | `number`         | Yes      | Max budget in USDC (> 0)          |
| `delivery_format` | `DeliveryFormat` | No       | Preferred content format          |
| `deadline`        | `ISOTimestamp`   | No       | Delivery deadline                 |

---

## 3. Service Quote (Quote Response)

**Endpoint:** `POST /ivxp/request` (response)
**Direction:** Provider -> Client

### Response: `ServiceQuote`

```json
{
  "protocol": "IVXP/1.0",
  "message_type": "service_quote",
  "timestamp": "2026-02-05T12:01:05Z",
  "order_id": "ivxp-550e8400-e29b-41d4-a716-446655440000",
  "provider_agent": {
    "name": "IVXP Demo Provider",
    "wallet_address": "0x1234567890abcdef1234567890abcdef12345678"
  },
  "quote": {
    "price_usdc": 5.0,
    "estimated_delivery": "2026-02-05T14:01:05Z",
    "payment_address": "0x1234567890abcdef1234567890abcdef12345678",
    "network": "base-sepolia",
    "token_contract": "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
  },
  "terms": {
    "payment_timeout": 3600,
    "revision_policy": "One free revision within 24 hours",
    "refund_policy": "Full refund if not delivered within estimated time"
  }
}
```

| Field            | Type              | Required | Description                                                                                                                                      |
| ---------------- | ----------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `protocol`       | `ProtocolVersion` | Yes      | Must be `"IVXP/1.0"`                                                                                                                             |
| `message_type`   | `"service_quote"` | Yes      | Message discriminator                                                                                                                            |
| `timestamp`      | `ISOTimestamp`    | Yes      | Quote timestamp                                                                                                                                  |
| `order_id`       | `string`          | Yes      | Unique order ID (`ivxp-{uuid-v4}`). UUID v4 lowercase hex. Pattern: `^ivxp-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$` |
| `provider_agent` | `ProviderAgent`   | Yes      | Provider identification                                                                                                                          |
| `quote`          | `QuoteDetails`    | Yes      | Pricing and payment info                                                                                                                         |
| `terms`          | `QuoteTerms`      | No       | Payment/service terms                                                                                                                            |

### `ProviderAgent`

| Field            | Type         | Required | Description         |
| ---------------- | ------------ | -------- | ------------------- |
| `name`           | `string`     | Yes      | Provider name       |
| `wallet_address` | `HexAddress` | Yes      | Provider's wallet   |
| `public_key`     | `HexAddress` | No       | Provider public key |

### `QuoteDetails`

| Field                | Type           | Required | Description                |
| -------------------- | -------------- | -------- | -------------------------- |
| `price_usdc`         | `number`       | Yes      | Quoted price in USDC (> 0) |
| `estimated_delivery` | `ISOTimestamp` | Yes      | Estimated delivery time    |
| `payment_address`    | `HexAddress`   | Yes      | Payment destination        |
| `network`            | `NetworkId`    | Yes      | Blockchain network         |
| `token_contract`     | `HexAddress`   | No       | USDC contract address      |

### `QuoteTerms`

| Field             | Type      | Required | Description              |
| ----------------- | --------- | -------- | ------------------------ |
| `payment_timeout` | `integer` | No       | Timeout in seconds (> 0) |
| `revision_policy` | `string`  | No       | Revision policy text     |
| `refund_policy`   | `string`  | No       | Refund policy text       |

---

## 4. Delivery Request

**Endpoint:** `POST /ivxp/deliver`
**Direction:** Client -> Provider

### Request: `DeliveryRequest`

```json
{
  "protocol": "IVXP/1.0",
  "message_type": "delivery_request",
  "timestamp": "2026-02-05T12:05:00Z",
  "order_id": "ivxp-550e8400-e29b-41d4-a716-446655440000",
  "payment_proof": {
    "tx_hash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    "from_address": "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    "network": "base-sepolia",
    "to_address": "0x1234567890abcdef1234567890abcdef12345678",
    "amount_usdc": "5000000",
    "block_number": 12345678
  },
  "delivery_endpoint": "https://my-agent.example.com/ivxp/callback",
  "signature": "0x1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c1b",
  "signed_message": "Order: ivxp-550e8400-e29b-41d4-a716-446655440000 | Payment: 0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890 | Timestamp: 2026-02-05T12:05:00Z"
}
```

| Field               | Type                 | Required | Description            |
| ------------------- | -------------------- | -------- | ---------------------- |
| `protocol`          | `ProtocolVersion`    | Yes      | Must be `"IVXP/1.0"`   |
| `message_type`      | `"delivery_request"` | Yes      | Message discriminator  |
| `timestamp`         | `ISOTimestamp`       | Yes      | Request timestamp      |
| `order_id`          | `string`             | Yes      | Order ID from quote    |
| `payment_proof`     | `PaymentProof`       | Yes      | On-chain payment proof |
| `delivery_endpoint` | `string` (URL)       | No       | P2P push endpoint      |
| `signature`         | `HexSignature`       | Yes      | EIP-191 signature      |
| `signed_message`    | `string`             | Yes      | Signed message text    |

### `PaymentProof`

| Field          | Type         | Required | Description                  |
| -------------- | ------------ | -------- | ---------------------------- |
| `tx_hash`      | `HexHash`    | Yes      | Transaction hash             |
| `from_address` | `HexAddress` | Yes      | Sender wallet                |
| `network`      | `NetworkId`  | Yes      | Payment network              |
| `to_address`   | `HexAddress` | No       | Recipient wallet             |
| `amount_usdc`  | `string`     | No       | Raw USDC amount (6 decimals) |
| `block_number` | `integer`    | No       | Block number                 |

### Signed Message Format

```
IVXP-DELIVER | Order: {order_id} | Payment: {tx_hash} | Nonce: {nonce} | Timestamp: {timestamp}
```

The `nonce` is a unique random string (min 16 chars) generated per request to prevent replay attacks.

---

## 5. Delivery Accepted (Delivery Response)

**Endpoint:** `POST /ivxp/deliver` (response)
**Direction:** Provider -> Client

### Response: `DeliveryAccepted`

```json
{
  "status": "accepted",
  "order_id": "ivxp-550e8400-e29b-41d4-a716-446655440000",
  "message": "Payment verified. Processing your request."
}
```

| Field      | Type         | Required | Description            |
| ---------- | ------------ | -------- | ---------------------- |
| `status`   | `"accepted"` | Yes      | Always `"accepted"`    |
| `order_id` | `string`     | Yes      | Order identifier       |
| `message`  | `string`     | Yes      | Human-readable message |

---

## 6. Order Status

**Endpoint:** `GET /ivxp/status/{order_id}`
**Direction:** Provider -> Client

### Response: `OrderStatusResponse`

```json
{
  "order_id": "ivxp-550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "created_at": "2026-02-05T12:01:05Z",
  "service_type": "code_review",
  "price_usdc": 5.0
}
```

| Field          | Type           | Required | Description        |
| -------------- | -------------- | -------- | ------------------ |
| `order_id`     | `string`       | Yes      | Order identifier   |
| `status`       | `OrderStatus`  | Yes      | Current status     |
| `created_at`   | `ISOTimestamp` | Yes      | Creation timestamp |
| `service_type` | `string`       | Yes      | Service type       |
| `price_usdc`   | `number`       | Yes      | Quoted price       |

Status values: `"quoted"`, `"paid"`, `"processing"`, `"delivered"`, `"delivery_failed"`

---

## 7. Download Deliverable

**Endpoint:** `GET /ivxp/download/{order_id}`
**Direction:** Provider -> Client

### Response: `DeliveryResponse`

```json
{
  "protocol": "IVXP/1.0",
  "message_type": "service_delivery",
  "timestamp": "2026-02-05T14:00:00Z",
  "order_id": "ivxp-550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "provider_agent": {
    "name": "IVXP Demo Provider",
    "wallet_address": "0x1234567890abcdef1234567890abcdef12345678"
  },
  "deliverable": {
    "type": "code_review_result",
    "format": "markdown",
    "content": "## Code Review Results\n\n### Security Issues Found\n\n1. **SQL Injection** in auth.ts:42..."
  },
  "content_hash": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "delivered_at": "2026-02-05T14:00:00Z"
}
```

| Field            | Type                    | Required | Description                  |
| ---------------- | ----------------------- | -------- | ---------------------------- |
| `protocol`       | `ProtocolVersion`       | Yes      | Must be `"IVXP/1.0"`         |
| `message_type`   | `"service_delivery"`    | Yes      | Message discriminator        |
| `timestamp`      | `ISOTimestamp`          | Yes      | Delivery timestamp           |
| `order_id`       | `string`                | Yes      | Order identifier             |
| `status`         | `"completed"`           | Yes      | Always `"completed"`         |
| `provider_agent` | `DeliveryProviderAgent` | Yes      | Provider info                |
| `deliverable`    | `Deliverable`           | Yes      | The deliverable payload      |
| `content_hash`   | `string`                | No       | SHA-256 integrity hash       |
| `delivered_at`   | `ISOTimestamp`          | No       | Production timestamp         |
| `signature`      | `HexSignature`          | No       | Provider's EIP-191 signature |
| `signed_message` | `string`                | No       | Signed message text          |

### `Deliverable`

| Field     | Type      | Required | Description                 |
| --------- | --------- | -------- | --------------------------- |
| `type`    | `string`  | Yes      | Content type identifier     |
| `format`  | `string`  | No       | Content format              |
| `content` | `unknown` | Yes      | Content (varies by service) |

---

## 8. Error Response (`IVXPErrorResponse`)

All endpoints may return an `ErrorResponse`:

```json
{
  "error": "ORDER_NOT_FOUND",
  "message": "No order found with ID ivxp-invalid-id",
  "details": {
    "order_id": "ivxp-invalid-id"
  }
}
```

| Field     | Type            | Required | Description                       |
| --------- | --------------- | -------- | --------------------------------- |
| `error`   | `IVXPErrorCode` | Yes      | Error code (SCREAMING_SNAKE_CASE) |
| `message` | `string`        | Yes      | Human-readable error message      |
| `details` | `object`        | No       | Additional error context          |

See [error-codes.md](./error-codes.md) for the complete error taxonomy.

---

## Wire Format Conventions

1. All field names use `snake_case` for Python compatibility
2. The TypeScript SDK transforms to `camelCase` internally
3. All timestamps are ISO 8601 with timezone (`Z` or `+/-HH:MM`)
4. All Ethereum addresses are hex-encoded with `0x` prefix
5. USDC amounts in message fields are `number` type (human-readable)
6. USDC amounts in `PaymentProof.amount_usdc` are `string` type (raw 6-decimal)
7. JSON schemas for all messages are in the `schemas/` directory
