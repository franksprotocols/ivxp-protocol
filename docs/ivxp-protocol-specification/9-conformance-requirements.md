---
title: 9. Conformance Requirements
description: Provider/client conformance requirements and versioning.
---

# 9. Conformance Requirements

### 9.1 Provider Conformance

A conformant IVXP/1.0 Provider must:

**Required endpoints (all mandatory):**

- `GET /ivxp/catalog` — return a valid `ServiceCatalog` with `protocol: "IVXP/1.0"`, `wallet_address`, and at least one service
- `POST /ivxp/request` — accept a `ServiceRequest`, return a `ServiceQuote` with a unique `order_id`
- `POST /ivxp/deliver` — verify payment on-chain, verify EIP-191 signature, return `DeliveryAccepted`
- `GET /ivxp/status/{order_id}` — return current `OrderStatusResponse`
- `GET /ivxp/download/{order_id}` — return `DeliveryResponse` with `content_hash` when order is `delivered` or `delivery_failed` and a deliverable exists

**Required behaviors:**

- Verify all payment checks (Section 4.3) before accepting a delivery request
- Verify EIP-191 signature before accepting a delivery request
- If a nonce is included in the delivery request, enforce per-order nonce uniqueness
- Verify `signed_message` exactly matches the provider's declared signature profile using values reconstructed from request context
- Validate timestamp freshness (MAX_TIMESTAMP_AGE = 300s)
- Enforce payment timeout (default 3600s)
- Use integer micro-USDC arithmetic (`10^6`) for amount checks and comparison
- Enforce `MIN_CONFIRMATIONS` (default 1) before treating payment as settled
- Compute and include `content_hash` in all `DeliveryResponse` messages
- Store deliverables for download even when P2P push fails, and retain them for at least 24 hours
- Return `410 ORDER_EXPIRED` when download is requested after the retention window
- Return error responses in the standard `IVXPErrorResponse` format
- Serve all endpoints over HTTPS

**Optional capabilities:**

- P2P push delivery to `delivery_endpoint` (P1). Providers should apply SSRF protections: HTTPS-only, no localhost/private-link-local targets, bounded timeout/retries, and payload size limits.
- SSE streaming progress updates (P1)
- `POST /ivxp/confirm` — accept delivery confirmation (IVXP/1.1)

### 9.2 Client Conformance

A conformant IVXP/1.0 Client must:

**Required behaviors:**

- Include `protocol: "IVXP/1.0"` in all request bodies (`POST /ivxp/request`, `POST /ivxp/deliver`)
- Include a valid `wallet_address` in `client_agent`
- For strict signature profile, generate a unique `nonce` field (min 16 chars) for each delivery request
- Sign the delivery request message using EIP-191 (`personal_sign`)
- Build `signed_message` according to the provider's documented signature profile (strict or minimal)
- Verify `content_hash` against the received deliverable before processing
- Handle `delivery_failed` status by downloading via `GET /ivxp/download/{order_id}`

**Required fields to validate in responses:**

- `ServiceQuote`: `order_id` matches pattern `^ivxp-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`
- `ServiceQuote`: `quote.network` is a supported network ID
- `OrderStatusResponse`: `status` is one of `quoted`, `paid`, `processing`, `delivered`, `delivery_failed`
- `DeliveryResponse`: `content_hash` matches `^sha256:[a-f0-9]{64}$`
- `DeliveryResponse`: computed hash of `deliverable.content` matches `content_hash`

**Optional capabilities:**

- Expose a `delivery_endpoint` for P2P push delivery (P2)

### 9.3 Versioning

The `protocol` field in every IVXP message carries the version string `"IVXP/1.0"`. Implementations must:

- Reject messages with an unrecognized `protocol` value with HTTP 400
- By default, reject missing `protocol` with HTTP 400. Legacy fallback (`missing -> IVXP/1.0`) should only be enabled through explicit compatibility mode during migration.

Future versions (e.g., `"IVXP/1.1"`) will introduce optional capabilities (delivery confirmation, SSE streaming) without breaking IVXP/1.0 implementations.

---

## Related Documents

| Document                                   | Description                                             |
| ------------------------------------------ | ------------------------------------------------------- |
| [message-formats.md](./message-formats.md) | Complete message schemas with JSON examples             |
| [state-machine.md](./state-machine.md)     | Order lifecycle state transitions and sequence diagrams |
| [security.md](./security.md)               | EIP-191 signatures, payment verification, threat model  |
| [error-codes.md](./error-codes.md)         | Complete error code taxonomy with HTTP mappings         |
| [compatibility.md](./compatibility.md)     | Wire format conventions, cross-implementation notes     |
| [openapi.yaml](./openapi.yaml)             | OpenAPI 3.1 specification                               |

---

_IVXP Protocol Specification v1.0 — Intelligence Value Exchange Protocol_
