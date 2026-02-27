# IVXP Adapter Development Guide

This guide enables Framework Integrators to independently implement IVXP Adapters that bridge the IVXP/1.0 protocol into any framework (Express, Fastify, Next.js, Hono, LangGraph, MCP, etc.).

## 1. Overview

An IVXP Adapter wraps the core `@ivxp/sdk` client or provider behind a framework-specific interface. There are two adapter interfaces:

- **`IVXPClientAdapter`** — consumes IVXP services (client-side). Implements `getCatalog`, `requestQuote`, `requestDelivery`, `getStatus`, and `download`.
- **`IVXPProviderAdapter`** — exposes IVXP services (server-side). Implements `handleCatalog`, `handleRequest`, `handleDeliver`, `handleStatus`, and `handleDownload`.

Both interfaces are exported as type-only from `@ivxp/sdk`:

```typescript
import type { IVXPClientAdapter, IVXPProviderAdapter } from "@ivxp/sdk";
```

## 2. Prerequisites

- **Node.js** >= 20
- **TypeScript** >= 5.4
- **pnpm** (recommended) or npm
- Familiarity with the IVXP/1.0 protocol flow
- A test wallet private key (never use production keys during development)

Install the SDK and protocol packages:

```bash
pnpm add @ivxp/sdk @ivxp/protocol
```

## 3. Implementing IVXPClientAdapter

The `IVXPClientAdapter` interface maps 1:1 to the IVXP/1.0 client flow endpoints:

```typescript
import type {
  IVXPClientAdapter,
  ServiceRequestParams,
  DownloadOptions,
  ServiceCatalogOutput,
  ServiceQuoteOutput,
  OrderStatusResponseOutput,
  DeliveryResponseOutput,
} from "@ivxp/sdk";
import type {
  PaymentProofOutput,
  HexSignature,
  DeliveryAcceptedOutput,
} from "@ivxp/protocol";
```

| Method             | HTTP Endpoint              | Purpose                          |
| ------------------ | -------------------------- | -------------------------------- |
| `getCatalog`       | `GET /ivxp/catalog`        | Fetch provider service catalog   |
| `requestQuote`     | `POST /ivxp/request`       | Request a service quote          |
| `requestDelivery`  | `POST /ivxp/deliver`       | Notify payment and request delivery |
| `getStatus`        | `GET /ivxp/status/:orderId`| Poll order status                |
| `download`         | `GET /ivxp/download/:orderId` | Download the deliverable      |

### 3.1 Nonce Generation

Every delivery request must include a unique nonce to prevent replay attacks. Use the canonical generation method:

```typescript
import { randomBytes } from "crypto";
const nonce = randomBytes(16).toString("hex");
```

This produces a 32-character hex string. The nonce must be unique per order — providers reject duplicate nonces for the same `order_id`.

### 3.2 Signed Message Format

The `signedMessage` field in delivery requests must follow the canonical format:

```typescript
// signedMessage = `IVXP/1.0 nonce=${nonce} content_hash=${sha256(canonicalBody)}`
```

The provider extracts and validates:
- **Nonce** — must be unique per order (replay prevention)
- **Timestamp** — must be within 300 seconds of server time (freshness check)

### 3.3 Full Client Adapter Example

```typescript
import { randomBytes } from "node:crypto";
import {
  IVXPClient,
  IVXPError,
  createHttpClient,
  PROTOCOL_VERSION,
  type IVXPClientAdapter,
  type ServiceRequestParams,
  type DownloadOptions,
  type ServiceCatalogOutput,
  type ServiceQuoteOutput,
  type OrderStatusResponseOutput,
  type DeliveryResponseOutput,
} from "@ivxp/sdk";
import {
  DeliveryAcceptedSchema,
  type PaymentProofOutput,
  type HexSignature,
  type DeliveryAcceptedOutput,
  type JsonSerializable,
} from "@ivxp/protocol";

interface MyAdapterConfig {
  readonly network?: "base-sepolia";
}

export class MyFrameworkClientAdapter implements IVXPClientAdapter {
  private readonly client: IVXPClient;

  constructor(config: MyAdapterConfig = {}) {
    const privateKey = process.env.IVXP_PRIVATE_KEY;
    if (!privateKey) throw new Error("IVXP_PRIVATE_KEY environment variable is required");

    this.client = new IVXPClient({
      privateKey: privateKey as `0x${string}`,
      network: (process.env.IVXP_NETWORK ?? config.network ?? "base-sepolia") as "base-sepolia",
    });
  }

  async getCatalog(providerUrl: string): Promise<ServiceCatalogOutput> {
    return this.client.getCatalog(providerUrl);
  }

  async requestQuote(
    providerUrl: string,
    params: ServiceRequestParams,
  ): Promise<ServiceQuoteOutput> {
    return this.client.requestQuote(providerUrl, params);
  }

  async requestDelivery(
    providerUrl: string,
    orderId: string,
    paymentProof: PaymentProofOutput,
    signature: HexSignature,
    signedMessage: string,
  ): Promise<DeliveryAcceptedOutput> {
    const httpClient = createHttpClient();
    const normalizedUrl = providerUrl.replace(/\/+$/, "");
    const deliverUrl = `${normalizedUrl}/ivxp/deliver`;

    const body: JsonSerializable = {
      protocol: PROTOCOL_VERSION,
      message_type: "delivery_request",
      timestamp: new Date().toISOString(),
      order_id: orderId,
      payment_proof: {
        tx_hash: paymentProof.txHash,
        from_address: paymentProof.fromAddress,
        network: paymentProof.network,
        ...(paymentProof.toAddress !== undefined && {
          to_address: paymentProof.toAddress,
        }),
        ...(paymentProof.amountUsdc !== undefined && {
          amount_usdc: paymentProof.amountUsdc,
        }),
        ...(paymentProof.blockNumber !== undefined && {
          block_number: paymentProof.blockNumber,
        }),
      },
      signature,
      signed_message: signedMessage,
    };

    const rawResponse = await httpClient.post<unknown>(deliverUrl, body);
    return DeliveryAcceptedSchema.parse(rawResponse);
  }

  async getStatus(
    providerUrl: string,
    orderId: string,
  ): Promise<OrderStatusResponseOutput> {
    return this.client.getOrderStatus(providerUrl, orderId);
  }

  async download(
    providerUrl: string,
    orderId: string,
    options?: DownloadOptions,
  ): Promise<DeliveryResponseOutput> {
    return this.client.downloadDeliverable(providerUrl, orderId, options);
  }
}

/** Build canonical nonce per IVXP/1.0 spec (32-char hex). */
export function buildNonce(): string {
  return randomBytes(16).toString("hex");
}

/** Build canonical signed_message per IVXP/1.0 spec. */
export function buildSignedMessage(params: {
  readonly nonce: string;
  readonly contentHash: string;
}): string {
  return `IVXP/1.0 nonce=${params.nonce} content_hash=${params.contentHash}`;
}

/** Factory: create adapter from environment variables. */
export function createMyFrameworkClientAdapter(): MyFrameworkClientAdapter {
  const providerUrl = process.env.IVXP_PROVIDER_URL;
  if (!providerUrl) throw new Error("IVXP_PROVIDER_URL environment variable is required");
  // IVXP_PRIVATE_KEY and IVXP_NETWORK are read inside the constructor
  return new MyFrameworkClientAdapter();
}
```

## 4. Implementing IVXPProviderAdapter

The `IVXPProviderAdapter` interface maps 1:1 to the IVXP/1.0 provider endpoints:

```typescript
import type {
  IVXPProviderAdapter,
  IVXPProviderConfig,
  ServiceCatalogOutput,
  ServiceQuoteOutput,
  OrderStatusResponseOutput,
  DeliveryResponseOutput,
} from "@ivxp/sdk";
import type {
  ServiceRequestOutput,
  DeliveryRequestOutput,
  DeliveryAcceptedOutput,
} from "@ivxp/protocol";
```

| Method           | HTTP Endpoint                 | Purpose                        |
| ---------------- | ----------------------------- | ------------------------------ |
| `handleCatalog`  | `GET /ivxp/catalog`           | Return service catalog         |
| `handleRequest`  | `POST /ivxp/request`          | Accept/reject service request  |
| `handleDeliver`  | `POST /ivxp/deliver`          | Verify payment, begin delivery |
| `handleStatus`   | `GET /ivxp/status/:orderId`   | Return order status            |
| `handleDownload` | `GET /ivxp/download/:orderId` | Stream/return deliverable      |

### 4.1 Full Provider Adapter Example

```typescript
import {
  IVXPProvider,
  IVXPError,
  type IVXPProviderAdapter,
  type IVXPProviderConfig,
  type ServiceCatalogOutput,
  type ServiceQuoteOutput,
  type OrderStatusResponseOutput,
  type DeliveryResponseOutput,
} from "@ivxp/sdk";
import type {
  ServiceRequestOutput,
  DeliveryRequestOutput,
  DeliveryAcceptedOutput,
} from "@ivxp/protocol";
import {
  ServiceCatalogSchema,
  ServiceQuoteSchema,
  DeliveryAcceptedSchema,
} from "@ivxp/protocol";

interface MyProviderAdapterConfig {
  readonly network?: "base-sepolia";
}

export class MyFrameworkProviderAdapter implements IVXPProviderAdapter {
  private readonly provider: IVXPProvider;

  constructor(
    config: MyProviderAdapterConfig = {},
    providerConfig: IVXPProviderConfig,
  ) {
    const privateKey = process.env.IVXP_PRIVATE_KEY;
    if (!privateKey) throw new Error("IVXP_PRIVATE_KEY environment variable is required");

    this.provider = new IVXPProvider(providerConfig);
  }

  async handleCatalog(): Promise<ServiceCatalogOutput> {
    const wireCatalog = await this.provider.getCatalog();
    return ServiceCatalogSchema.parse(wireCatalog);
  }

  async handleRequest(
    body: ServiceRequestOutput,
  ): Promise<ServiceQuoteOutput> {
    // Convert camelCase input to wire-format (snake_case)
    const wireRequest = {
      protocol: body.protocol,
      message_type: "service_request" as const,
      timestamp: body.timestamp,
      client_agent: {
        name: body.clientAgent.name,
        wallet_address: body.clientAgent.walletAddress,
        contact_endpoint: body.clientAgent.contactEndpoint,
      },
      service_request: {
        type: body.serviceRequest.type,
        description: body.serviceRequest.description,
        budget_usdc: body.serviceRequest.budgetUsdc,
        delivery_format: body.serviceRequest.deliveryFormat,
        deadline: body.serviceRequest.deadline,
      },
    };
    const wireQuote = await this.provider.handleQuoteRequest(wireRequest);
    return ServiceQuoteSchema.parse(wireQuote);
  }

  async handleDeliver(
    body: DeliveryRequestOutput,
  ): Promise<DeliveryAcceptedOutput> {
    // Convert camelCase input to wire-format (snake_case)
    const wireRequest = {
      protocol: body.protocol,
      message_type: "delivery_request" as const,
      timestamp: body.timestamp,
      order_id: body.orderId,
      payment_proof: {
        tx_hash: body.paymentProof.txHash,
        from_address: body.paymentProof.fromAddress,
        network: body.paymentProof.network,
      },
      delivery_endpoint: body.deliveryEndpoint,
      signature: body.signature,
      signed_message: body.signedMessage,
    };
    const wireAccepted =
      await this.provider.handleDeliveryRequest(wireRequest);
    return DeliveryAcceptedSchema.parse(wireAccepted);
  }

  async handleStatus(orderId: string): Promise<OrderStatusResponseOutput> {
    const order = await this.provider.getOrder(orderId);
    if (!order) {
      throw new IVXPError(
        `Order not found: ${orderId}`,
        "ORDER_NOT_FOUND",
        { orderId },
      );
    }
    return {
      orderId: order.orderId,
      status: order.status as OrderStatusResponseOutput["status"],
      createdAt: order.createdAt,
      serviceType: order.serviceType,
      priceUsdc: parseFloat(order.priceUsdc),
    };
  }

  async handleDownload(orderId: string): Promise<DeliveryResponseOutput> {
    const wireDownload =
      await this.provider.handleDownloadRequest(orderId);
    const walletAddress = await this.provider.getAddress();

    return {
      protocol: "IVXP/1.0",
      messageType: "service_delivery",
      timestamp: new Date().toISOString(),
      orderId: wireDownload.order_id,
      status: "completed",
      providerAgent: { name: "my-provider", walletAddress },
      deliverable: {
        type: wireDownload.content_type,
        format: undefined,
        content: wireDownload.content,
      },
      contentHash: wireDownload.content_hash,
      deliveredAt: undefined,
      signature: undefined,
      signedMessage: undefined,
    };
  }
}
```

## 5. The callService() Flow (9 Steps)

The complete IVXP/1.0 service lifecycle consists of 9 steps. Your adapter must support all of them:

```
Client                                Provider
  │                                      │
  │  1. GET /ivxp/catalog                │
  │ ──────────────────────────────────►  │  getCatalog()
  │  ◄──────────────────────────────────  │  ServiceCatalog
  │                                      │
  │  2. POST /ivxp/request               │
  │ ──────────────────────────────────►  │  requestQuote()
  │  ◄──────────────────────────────────  │  ServiceQuote (orderId, price, paymentAddress)
  │                                      │
  │  3. Sign message (EIP-191)           │
  │  (local — no HTTP call)              │
  │                                      │
  │  4. Send USDC payment (on-chain)     │
  │  (blockchain transaction)            │
  │                                      │
  │  5. POST /ivxp/deliver               │
  │ ──────────────────────────────────►  │  requestDelivery()
  │  ◄──────────────────────────────────  │  DeliveryAccepted
  │                                      │
  │  6. GET /ivxp/status/:orderId        │
  │ ──────────────────────────────────►  │  getStatus() (poll until delivered)
  │  ◄──────────────────────────────────  │  OrderStatusResponse
  │                                      │
  │  7. GET /ivxp/download/:orderId      │
  │ ──────────────────────────────────►  │  download()
  │  ◄──────────────────────────────────  │  DeliveryResponse (content + content_hash)
  │                                      │
  │  8. Verify delivery                  │
  │  (local — recompute content_hash)    │
  │                                      │
  │  9. Handle errors                    │
  │  (IVXPError codes, retries, etc.)    │
```

### Step-by-step details

1. **getCatalog** — Fetch the provider's service catalog. Verify the response contains `services[]` with `type`, `base_price_usdc`, and `estimated_delivery_hours`.

2. **requestQuote** — Send a service request with `serviceType`, `description`, and `budgetUsdc`. Receive an `orderId`, quoted `priceUsdc`, and `paymentAddress`.

3. **Sign message** — Construct the canonical `signedMessage` (see Section 3.2) and sign it with the client's private key using EIP-191 personal sign.

4. **Send USDC payment** — Transfer the quoted `priceUsdc` in USDC to the provider's `paymentAddress` on the specified `network`. Record the `txHash`.

5. **requestDelivery** — POST the `payment_proof` (txHash, fromAddress, network), `signature`, and `signed_message` to the provider. The provider verifies: order exists, order is in `quoted` status, signed message contains the order_id, payment network matches, on-chain payment is valid, and EIP-191 signature is valid.

6. **Poll status** — Poll `GET /ivxp/status/:orderId` until the status transitions to `delivered`. Use exponential backoff.

7. **Download** — Fetch the deliverable content and its `content_hash`.

8. **Verify delivery** — Recompute the SHA-256 hash of the content and compare it to the provider's `content_hash`. This ensures content integrity.

9. **Handle errors** — Map `IVXPError` codes to your framework's error model. Key error codes: `ORDER_NOT_FOUND`, `INVALID_ORDER_STATUS`, `INVALID_SIGNED_MESSAGE`, `NETWORK_MISMATCH`, `PAYMENT_VERIFICATION_FAILED`, `SIGNATURE_VERIFICATION_FAILED`.

## 6. Key Management

### 6.1 Required Environment Variables

| Variable            | Required | Description                                    |
| ------------------- | -------- | ---------------------------------------------- |
| `IVXP_PRIVATE_KEY`  | Yes      | EIP-191 private key for signing (hex, 0x-prefixed) |
| `IVXP_NETWORK`      | No       | Blockchain network (default: `base-sepolia`)   |
| `IVXP_PROVIDER_URL` | Yes*     | Provider base URL (* required for client adapters) |

### 6.2 Loading Keys Safely

Always load keys from environment variables. Never hardcode private keys in source code.

```typescript
const privateKey = process.env.IVXP_PRIVATE_KEY;
if (!privateKey) throw new Error("IVXP_PRIVATE_KEY environment variable is required");
const network = process.env.IVXP_NETWORK ?? "base-sepolia";
const providerUrl = process.env.IVXP_PROVIDER_URL;
if (!providerUrl) throw new Error("IVXP_PROVIDER_URL environment variable is required");
```

For local development, use a `.env` file (add `.env` to `.gitignore`):

```bash
# .env (never commit this file)
# Never use a real private key here
IVXP_PRIVATE_KEY=0x<your-test-private-key-here>
IVXP_NETWORK=base-sepolia
IVXP_PROVIDER_URL=http://localhost:3000
```

## 7. Testing with the Interop Test Suite

The IVXP monorepo includes a comprehensive interop test suite that validates adapter conformance. Your adapter must pass these tests before publishing.

### Running the interop tests

```bash
# Build dependencies first
pnpm --filter @ivxp/protocol build
pnpm --filter @ivxp/test-utils build
pnpm --filter @ivxp/sdk build

# Build your adapter
pnpm --filter @ivxp/adapter-{framework} build

# Run interop tests
pnpm --filter @ivxp/sdk test:interop:{framework}
```

### Test architecture

The interop test suite validates three interop paths for each adapter:

1. **Your Client Adapter <-> TS Provider** — Your client adapter talks to the reference `IVXPProvider` implementation.
2. **TS Client <-> Your Provider Adapter** — The reference `IVXPClient` talks to your provider adapter.
3. **Your Client Adapter <-> Python Provider** — Cross-language interop with the Python reference provider.

Each test path exercises the full protocol flow: catalog -> quote -> deliver -> poll -> download -> verify content_hash.

### Test utilities

The test suite provides shared fixtures and helpers:

```typescript
import { TEST_ACCOUNTS, MockCryptoService, MockPaymentService } from "@ivxp/test-utils";
import { startProviderFixture } from "./fixtures/provider-fixture.js";
import { httpGet, httpPost, buildDeliveryRequestBody, waitForCondition } from "./utils/test-helpers.js";
import { assertValidContentHash } from "./utils/assertions.js";
import { computeContentHash } from "@ivxp/sdk";
```

- `TEST_ACCOUNTS` — Pre-defined client and provider test wallets
- `MockCryptoService` / `MockPaymentService` — Mock services for testing without a real blockchain
- `startProviderFixture()` — Starts a real `IVXPProvider` HTTP server on an ephemeral port
- `assertValidContentHash()` — Validates `sha256:` prefixed content hash format
- `computeContentHash()` — Recomputes SHA-256 hash for integrity verification

## 8. Conformance Checklist

Your adapter must pass all items in this checklist to be considered conformant. Each item maps to a test in the interop test matrix.

### Client Adapter Conformance

| # | Requirement | Interop Test |
|---|-------------|--------------|
| C1 | `getCatalog()` returns valid `ServiceCatalogOutput` with `provider`, `walletAddress`, and `services[]` | "should fetch catalog via adapter" |
| C2 | `requestQuote()` returns `ServiceQuoteOutput` with `orderId` (prefixed `ivxp-`), `priceUsdc`, and `network` | "should request a quote via adapter" |
| C3 | `requestDelivery()` sends wire-format `delivery_request` with `payment_proof`, `signature`, and `signed_message` | "should complete full flow" |
| C4 | `getStatus()` returns `OrderStatusResponseOutput` with correct `orderId` and `status` | "should complete full flow" (poll step) |
| C5 | `download()` returns `DeliveryResponseOutput` with `content` and `contentHash` | "should complete full flow" (download step) |
| C6 | Content hash integrity: recomputed `sha256(content)` matches provider's `content_hash` (FR12) | "should verify content_hash" |
| C7 | Nonce is 32-char hex from `randomBytes(16).toString("hex")` | "buildNonce returns 32-char hex" |
| C8 | Nonce is unique per call | "buildNonce returns unique values" |
| C9 | `signedMessage` follows canonical `IVXP/1.0 nonce=... content_hash=...` format | "buildSignedMessage produces canonical format" |
| C10 | All `IVXPError` instances are converted to framework-native errors | "converts IVXPError to native error" |

### Provider Adapter Conformance

| # | Requirement | Interop Test |
|---|-------------|--------------|
| P1 | `handleCatalog()` returns valid `ServiceCatalogOutput` | "should handle catalog via adapter" |
| P2 | `handleRequest()` accepts `ServiceRequestOutput` and returns `ServiceQuoteOutput` | "should handle request via adapter" |
| P3 | `handleDeliver()` validates timestamp freshness (within 300s) | "rejects stale timestamp" |
| P4 | `handleDeliver()` validates nonce uniqueness per order | "rejects duplicate nonce" |
| P5 | `handleDeliver()` allows same nonce for different orders | "allows same nonce for different orders" |
| P6 | `handleDeliver()` rejects missing nonce in signed message | "rejects when nonce field is missing" |
| P7 | `handleDeliver()` rejects missing timestamp in signed message | "rejects when timestamp field is missing" |
| P8 | `handleStatus()` returns `OrderStatusResponseOutput` for existing orders | "returns order status" |
| P9 | `handleStatus()` throws `ORDER_NOT_FOUND` for missing orders | "throws ORDER_NOT_FOUND" |
| P10 | `handleDownload()` returns `DeliveryResponseOutput` with `contentHash` | "returns DeliveryResponseOutput with content_hash" |
| P11 | Wire-format conversion: camelCase input -> snake_case for `IVXPProvider` | All handler tests |
| P12 | Nonce not registered when on-chain checks fail (allows retry) | "does not register nonce when on-chain checks fail" |

### Cross-Language Conformance

| # | Requirement | Interop Test |
|---|-------------|--------------|
| X1 | Adapter <-> Python Provider full flow succeeds | "should complete full flow against Python provider" |
| X2 | Content hash matches across TS and Python implementations | "content_hash verified across languages" |
| X3 | TS Client can talk to adapter's HTTP surface | "should serve TS Client HTTP requests" |

## 9. Publishing to npm

### 9.1 Naming Convention

IVXP adapter packages follow a strict naming convention:

| Scope | Pattern | Example |
|-------|---------|---------|
| Official (IVXP team) | `@ivxp/adapter-{framework}` | `@ivxp/adapter-a2a`, `@ivxp/adapter-mcp` |
| Community | `ivxp-adapter-{framework}` | `ivxp-adapter-express`, `ivxp-adapter-hono` |

Your `package.json` should include:

```json
{
  "name": "ivxp-adapter-{framework}",
  "version": "1.0.0",
  "description": "IVXP adapter for {Framework}",
  "keywords": ["ivxp", "adapter", "{framework}"],
  "peerDependencies": {
    "@ivxp/sdk": "^3.0.0",
    "@ivxp/protocol": "^3.0.0"
  }
}
```

### 9.2 Official vs Community Packages

| | Official (`@ivxp/adapter-*`) | Community (`ivxp-adapter-*`) |
|---|---|---|
| Maintained by | IVXP core team | Community contributors |
| Published under | `@ivxp` npm scope | Personal/org npm scope |
| Interop CI gate | Required — CI blocks publish on test failure | Recommended — run interop tests locally |
| Naming | `@ivxp/adapter-{framework}` | `ivxp-adapter-{framework}` |
| Examples | `@ivxp/adapter-a2a`, `@ivxp/adapter-mcp`, `@ivxp/adapter-langgraph` | `ivxp-adapter-express`, `ivxp-adapter-hono` |

To publish a community adapter:

1. Ensure all conformance checklist items pass (Section 8)
2. Use the `ivxp-adapter-{framework}` naming convention
3. List `@ivxp/sdk` and `@ivxp/protocol` as `peerDependencies`
4. Include a `README.md` with setup instructions and the conformance checklist results
5. Publish to npm:

```bash
npm publish --access public
```

To propose an official adapter, open a PR to the `ivxp-protocol` monorepo under `packages/adapter-{framework}/` and ensure the interop CI pipeline passes.
