---
title: 4. Integration Contract
description: Adapter direction and minimum interfaces.
---

# 4. Integration Contract

This section defines what an external framework must implement to integrate IVXP. Read this section if you are building an IVXP adapter for A2A, LangGraph, AutoGen, or any other Agent framework.

### 4.1 Integration Direction

The correct integration direction is unambiguous:

```text
✅ CORRECT: External framework implements an IVXP Adapter
           Framework ──[IVXP Adapter]──> IVXP Protocol

❌ WRONG:   IVXP becomes an extension of a framework
           IVXP ──[Extension]──> Framework
```

**Why this matters:** If IVXP were an extension of A2A, then LangGraph Agents, AutoGen Agents, and any non-A2A Agent could never participate in IVXP transactions. The economic network would be fragmented by framework boundaries. By keeping IVXP independent, any Agent from any framework can transact with any other Agent — the network effect accumulates in the protocol, not in any single framework.

The analogy is precise: banks implement SWIFT adapters. SWIFT does not become a feature of any bank's internal system. The same principle applies here.

### 4.2 Minimum Adapter Interface

An IVXP Adapter for a Client-side framework must implement these five operations:

```typescript
interface IVXPClientAdapter {
  /**
   * Fetch the Provider's service catalog.
   * Maps to: GET {providerUrl}/ivxp/catalog
   */
  getCatalog(providerUrl: string): Promise<ServiceCatalog>;

  /**
   * Request a service quote from a Provider.
   * Maps to: POST {providerUrl}/ivxp/request
   * Returns an order_id and price.
   */
  requestQuote(providerUrl: string, request: ServiceRequestDetails): Promise<ServiceQuote>;

  /**
   * Submit payment proof and request delivery.
   * Maps to: POST {providerUrl}/ivxp/deliver
   * Requires: on-chain tx_hash and EIP-191 signature.
   */
  requestDelivery(
    providerUrl: string,
    orderId: string,
    paymentProof: PaymentProof,
    signature: string,
    signedMessage: string,
  ): Promise<DeliveryAccepted>;

  /**
   * Poll order status.
   * Maps to: GET {providerUrl}/ivxp/status/{orderId}
   */
  getStatus(providerUrl: string, orderId: string): Promise<OrderStatusResponse>;

  /**
   * Download the completed deliverable.
   * Maps to: GET {providerUrl}/ivxp/download/{orderId}
   * Only call when status is "delivered" or "delivery_failed".
   */
  download(providerUrl: string, orderId: string): Promise<DeliveryResponse>;
}
```

An IVXP Adapter for a Provider-side framework must implement these five endpoints:

```typescript
interface IVXPProviderAdapter {
  /** GET /ivxp/catalog — return available services and wallet address */
  handleCatalog(): ServiceCatalog;

  /** POST /ivxp/request — validate request, generate order_id, return quote */
  handleRequest(body: ServiceRequest): ServiceQuote;

  /**
   * POST /ivxp/deliver — verify payment on-chain, verify signature,
   * accept order, begin processing
   */
  handleDeliver(body: DeliveryRequest): DeliveryAccepted;

  /** GET /ivxp/status/:orderId — return current order state */
  handleStatus(orderId: string): OrderStatusResponse;

  /** GET /ivxp/download/:orderId — return deliverable when ready */
  handleDownload(orderId: string): DeliveryResponse;
}
```

For complete message type definitions, see [message-formats.md](./message-formats.md).

### 4.3 Identity and Payment Contract

Any IVXP implementation must conform to these identity and payment conventions:

#### Payment Currency and Network

| Parameter               | Value                                                           |
| ----------------------- | --------------------------------------------------------------- |
| Token                   | USDC (ERC-20, 6 decimals)                                       |
| Network (mainnet)       | Base Mainnet — Chain ID `8453`                                  |
| Network (testnet)       | Base Sepolia — Chain ID `84532`                                 |
| USDC contract (mainnet) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`                    |
| USDC contract (testnet) | `0x036CbD53842c5426634e7929541eC2318f3dCF7e`                    |
| Raw amount encoding     | `amount_usdc * 10^6` as string (e.g., `"5000000"` for 5.0 USDC) |

#### Identity: EIP-191 Signatures

The Client signs a delivery request message using EIP-191 (`personal_sign`).
The strict signature profile uses:

```text
IVXP-DELIVER | Order: {order_id} | Payment: {tx_hash} | Nonce: {nonce} | Timestamp: {timestamp}
```

| Field          | Description                                                 |
| -------------- | ----------------------------------------------------------- |
| `IVXP-DELIVER` | Fixed prefix — prevents cross-protocol replay               |
| `order_id`     | The order identifier from the quote                         |
| `tx_hash`      | The on-chain USDC transaction hash                          |
| `nonce`        | Optional replay-protection string (min 16 chars when used)  |
| `timestamp`    | ISO 8601 timestamp of the delivery request                  |

The Provider recovers the signer address from the signature and verifies it matches `payment_proof.from_address`. See [security.md](./security.md) for the full verification algorithm.

The `DeliveryRequest` payload may carry `nonce` as an extension field.
Providers should publish their accepted signature profile and rebuild the expected signed payload from request context before verification.

#### Payment Verification

The Provider must verify the payment on-chain, not by trusting the Client's `PaymentProof` fields. The required checks are:

1. `tx_hash` corresponds to a confirmed transaction on the specified network
2. The transaction's recipient matches `quote.payment_address`
3. The transferred USDC amount (raw units) is >= quoted amount (raw units)
4. The token contract is the correct USDC contract for the network
5. The sender matches the `client_agent.wallet_address` persisted when the order was created via `POST /ivxp/request`
6. The transaction has at least `MIN_CONFIRMATIONS` confirmations (default: 1, configurable)

Amount comparison must use integer arithmetic in micro-USDC units (`10^6`), never floating-point comparison.

### 4.4 A2A Integration Example

When an A2A Agent needs to call a paid IVXP service, the integration looks like this:

```text
A2A Task lifecycle          IVXP Order lifecycle
─────────────────           ────────────────────
submitted          ──>      (IVXP service request initiated)
input_required     ──>      quoted  (awaiting payment confirmation)
working            ──>      paid → processing
completed          ──>      delivered
failed             ──>      delivery_failed / expired
```

The A2A framework calls the IVXP Adapter when a task requires a paid capability. The IVXP Adapter handles the full payment and delivery flow. The result is returned as an A2A Task Artifact. The IVXP protocol state is fully independent of the A2A task state.

---

