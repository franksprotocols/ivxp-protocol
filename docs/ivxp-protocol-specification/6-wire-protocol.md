---
title: 6. Wire Protocol
description: Transport, endpoints, and error format.
---

# 6. Wire Protocol

### 6.1 Transport

| Parameter        | Value                                                              |
| ---------------- | ------------------------------------------------------------------ |
| Transport        | HTTPS (TLS 1.2+)                                                   |
| Data format      | JSON (`Content-Type: application/json`)                            |
| Encoding         | UTF-8                                                              |
| Protocol version | `"IVXP/1.0"` (in every request/response that includes a JSON body) |

All IVXP endpoints must be served over HTTPS. HTTP is not acceptable for production deployments.

For `GET /ivxp/catalog`, `GET /ivxp/status/{order_id}`, and `GET /ivxp/download/{order_id}`, the request carries no JSON body, so `protocol` is versioned through the endpoint contract and response body.

### 6.2 Endpoints

| Method | Path                        | Description                               |
| ------ | --------------------------- | ----------------------------------------- |
| `GET`  | `/ivxp/catalog`             | Get service catalog                       |
| `POST` | `/ivxp/request`             | Request a service quote                   |
| `POST` | `/ivxp/deliver`             | Submit payment proof and request delivery |
| `GET`  | `/ivxp/status/{order_id}`   | Check order status                        |
| `GET`  | `/ivxp/download/{order_id}` | Download completed deliverable            |

These are the wire-profile endpoints. Some SDK orchestration flows may use `/ivxp/orders/{orderId}/*`.
Implementations should publish their supported endpoint profile explicitly.

### 6.3 HTTP Status Codes

| Code  | Meaning             | Use Case                                               |
| ----- | ------------------- | ------------------------------------------------------ |
| `200` | Success             | Request handled successfully                           |
| `202` | Accepted            | Service processing, not yet complete                   |
| `400` | Bad Request         | Invalid message format or unsupported protocol version |
| `401` | Unauthorized        | Signature verification failed                          |
| `402` | Payment Required    | On-chain payment verification failed                   |
| `408` | Request Timeout     | Payment timeout exceeded                               |
| `409` | Conflict            | Invalid order state or duplicate delivery request      |
| `410` | Gone                | Order expired or deliverable retention elapsed         |
| `404` | Not Found           | Order missing or deliverable not ready                 |
| `500` | Server Error        | Internal Provider error                                |
| `503` | Service Unavailable | Provider temporarily unavailable                       |

### 6.4 Error Response Format

All error responses use this structure:

```json
{
  "error": "ORDER_NOT_FOUND",
  "message": "No order found with ID ivxp-invalid-id",
  "details": {
    "order_id": "ivxp-invalid-id"
  }
}
```

### 6.5 Field Naming Conventions

- All wire protocol field names use `snake_case` for cross-language compatibility.
- TypeScript SDK implementations may use `camelCase` internally but must serialize to `snake_case` on the wire.
- All timestamps are ISO 8601 with timezone (`Z` or `+/-HH:MM`).
- All Ethereum addresses are hex-encoded with `0x` prefix.

For complete message schemas and JSON examples, see [message-formats.md](./message-formats.md).

For the OpenAPI 3.1 specification, see [openapi.yaml](./openapi.yaml).

---

