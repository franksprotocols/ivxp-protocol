---
title: 3. Protocol Architecture
description: Roles, objects, and transaction model.
---

### 3.1 Core Roles

| Role               | Description                                                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Provider Agent** | An Agent that offers paid services. Runs an HTTP server implementing the IVXP endpoints. Holds an Ethereum wallet to receive USDC payments.    |
| **Client Agent**   | An Agent (or human-facing application) that consumes paid services. Holds an Ethereum wallet to send USDC payments and sign delivery requests. |

A single Agent may act as both Provider and Client in different transactions.

### 3.2 Core Objects

| Object           | Description                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Order**        | A single service transaction. Identified by `order_id` (format: `ivxp-{uuid-v4}`). Tracks state from quote to delivery.    |
| **Quote**        | A Provider's response to a service request. Contains `price_usdc`, `payment_address`, and `order_id`.                      |
| **PaymentProof** | The Client's evidence of on-chain payment. Contains `tx_hash`, `from_address`, and `network`.                              |
| **Deliverable**  | The service output. Contains `type`, optional `format`, and `content`. Integrity is verified via `content_hash` (SHA-256). |

### 3.3 The Eight-Step Transaction Model

Every IVXP transaction follows this sequence:

```text
Client Agent                              Provider Agent
     │                                         │
     │  1. GET /ivxp/catalog                   │
     │────────────────────────────────────────>│
     │<──────────── ServiceCatalog ────────────│
     │                                         │
     │  2. POST /ivxp/request                  │
     │     { client_agent, service_request }   │
     │────────────────────────────────────────>│
     │<──────────── ServiceQuote ──────────────│
     │     { order_id, price_usdc,             │
     │       payment_address }                 │
     │                                         │
     │  3. USDC transfer on Base L2            │
     │══════════════> [Blockchain] ════════════│
     │                                         │
     │  4. POST /ivxp/deliver                  │
     │     { order_id, payment_proof,          │
     │       nonce, signature, signed_message }│
     │────────────────────────────────────────>│
     │                                         │
     │  5. Provider verifies payment on-chain  │
     │                    [Blockchain] ════════│
     │                                         │
     │  6. Provider verifies EIP-191 signature │
     │<──────────── DeliveryAccepted ──────────│
     │                                         │
     │  7. GET /ivxp/status/{order_id}         │
     │────────────────────────────────────────>│
     │<──────────── { status: "delivered" } ───│
     │                                         │
     │  8. GET /ivxp/download/{order_id}       │
     │────────────────────────────────────────>│
     │<──────────── DeliveryResponse ──────────│
     │     { deliverable, content_hash }       │
     ▼                                         ▼
```

Steps 7 and 8 may be repeated (polling) until the order reaches a terminal state. If the Provider supports P2P push delivery, step 7 may be skipped — the Provider POSTs the deliverable directly to the Client's `delivery_endpoint`.

---
