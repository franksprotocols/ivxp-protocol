---
title: Compatibility
---

# IVXP/1.0 Wire Format Compatibility

This document describes wire format conventions and cross-implementation compatibility requirements.

## Field Naming Convention

All IVXP/1.0 wire protocol messages use `snake_case` field names for cross-language compatibility, particularly with the Python reference implementation.

| Wire Format (JSON) | TypeScript SDK (internal) |
| ------------------ | ------------------------- |
| `wallet_address`   | `walletAddress`           |
| `message_type`     | `messageType`             |
| `order_id`         | `orderId`                 |
| `base_price_usdc`  | `basePriceUsdc`           |
| `payment_address`  | `paymentAddress`          |
| `tx_hash`          | `txHash`                  |
| `from_address`     | `fromAddress`             |
| `content_hash`     | `contentHash`             |

The TypeScript SDK uses Zod schemas to transform between wire format (`snake_case`) and internal format (`camelCase`). Implementations in other languages should use the wire format directly.

## Content-Type

All IVXP endpoints use `application/json` for both request and response bodies.

```
Content-Type: application/json
Accept: application/json
```

## Endpoint Profiles

IVXP implementations in this repository currently appear in two compatible endpoint profiles:

| Profile | Endpoints | Typical Usage |
| ------- | --------- | ------------- |
| **Wire Profile** | `/ivxp/catalog`, `/ivxp/request`, `/ivxp/deliver`, `/ivxp/status/{order_id}`, `/ivxp/download/{order_id}` | protocol-level interoperability and reference providers |
| **SDK Workflow Profile** | `/ivxp/orders/{orderId}/payment`, `/ivxp/orders/{orderId}`, `/ivxp/orders/{orderId}/deliverable`, `/ivxp/orders/{orderId}/confirm` | some SDK orchestration flows |

Compatibility rule:

- Clients and providers MUST agree on one profile for a given integration.
- A provider MAY expose both profiles through explicit compatibility routing.
- Public documentation MUST state which profile is supported.

## Delivery Signature Profiles

`DeliveryRequest.signed_message` is required, but its exact string format is implementation-profile specific.

- **Strict profile (recommended):** canonical `IVXP-DELIVER | ... | Nonce: ... | Timestamp: ...`
- **Minimal profile:** any deterministic signed payload that binds order/payment context and can be verified against the signer address

Compatibility rule:

- Implementations MUST document the expected signed message rendering.
- Integrators MUST generate signed messages that match provider verification logic.

## Protocol Version Negotiation

The `protocol` field in every message must be exactly `"IVXP/1.0"`. If a provider receives a message with an unsupported protocol version, it returns:

```json
{
  "error": "PROTOCOL_VERSION_UNSUPPORTED",
  "message": "Only IVXP/1.0 is supported"
}
```

Future versions (IVXP/1.1, IVXP/2.0) will define their own negotiation mechanism.

## Backward-Compatible Extensions

IVXP/1.0 supports optional extension fields that do not break existing implementations:

- Fields marked as optional in the schema may be omitted
- Implementations MUST ignore unknown fields (forward compatibility)
- New optional fields may be added in minor versions without breaking changes

### Extension Fields in IVXP/1.0

| Message            | Field               | Added In | Description             |
| ------------------ | ------------------- | -------- | ----------------------- |
| `ServiceCatalog`   | `message_type`      | 1.0      | Optional discriminator  |
| `ServiceCatalog`   | `timestamp`         | 1.0      | Catalog generation time |
| `ServiceQuote`     | `terms`             | 1.0      | Payment/service terms   |
| `DeliveryRequest`  | `nonce`             | 1.0      | Replay-protection extension field |
| `DeliveryRequest`  | `delivery_endpoint` | 1.0      | P2P push endpoint       |
| `DeliveryResponse` | `content_hash`      | 1.0      | Integrity verification  |
| `DeliveryResponse` | `signature`         | 1.0      | Provider signature      |
| `PaymentProof`     | `to_address`        | 1.0      | Recipient address       |
| `PaymentProof`     | `amount_usdc`       | 1.0      | Payment amount          |
| `PaymentProof`     | `block_number`      | 1.0      | Block number            |

## Timestamp Format

All timestamps must be ISO 8601 with timezone information:

```
YYYY-MM-DDTHH:MM:SS[.fractional]Z
YYYY-MM-DDTHH:MM:SS[.fractional]+HH:MM
YYYY-MM-DDTHH:MM:SS[.fractional]-HH:MM
```

Regex: `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$`

Implementations SHOULD use UTC (`Z` suffix) for consistency.

## Address Normalization

Ethereum addresses are normalized to lowercase for comparison:

```
Input:  0xAbCdEf1234567890AbCdEf1234567890AbCdEf12
Output: 0xabcdef1234567890abcdef1234567890abcdef12
```

Both checksummed (EIP-55) and lowercase addresses are accepted on input.

## USDC Amount Representation

USDC amounts appear in two formats depending on context:

| Context                    | Type     | Example     | Description                      |
| -------------------------- | -------- | ----------- | -------------------------------- |
| Quote/Catalog fields       | `number` | `5.0`       | Human-readable USDC amount       |
| `PaymentProof.amount_usdc` | `string` | `"5000000"` | Raw on-chain amount (6 decimals) |

Conversion: `raw_amount = human_amount * 10^6`

## Cross-Implementation Testing

To verify compatibility between implementations:

1. Generate test messages from the TypeScript SDK
2. Validate against JSON schemas in `docs/protocol/schemas/`
3. Parse with the target implementation
4. Verify all fields are correctly interpreted
5. Generate response messages from the target implementation
6. Validate against JSON schemas
7. Parse with the TypeScript SDK
