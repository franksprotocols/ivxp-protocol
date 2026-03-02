---
title: Adapter Development
description: Design and implement production-ready IVXP adapters for external frameworks.
---

This guide defines adapter responsibilities, mapping rules, and verification criteria for framework integrators.

## 1. Adapter Interfaces

`@ivxp/sdk` exposes two adapter contracts:

- `IVXPClientAdapter`
- `IVXPProviderAdapter`

```typescript
import type { IVXPClientAdapter, IVXPProviderAdapter } from "@ivxp/sdk";
```

## 2. Client Adapter Responsibilities

A client adapter should implement:

- `getCatalog`
- `requestQuote`
- `requestDelivery`
- `getStatus`
- `download`

## 3. Provider Adapter Responsibilities

A provider adapter should implement:

- `handleCatalog`
- `handleRequest`
- `handleDeliver`
- `handleStatus`
- `handleDownload`

## 4. Mapping Rules

- wire protocol remains `snake_case`
- application-facing structures can be `camelCase`
- validate incoming payloads with protocol schemas before conversion

## 5. Security Rules

- enforce EIP-191 signature verification
- enforce payment verification on the configured network
- reject malformed or replay-like delivery requests

## 6. Route Contract Alignment

Before release, confirm route contract alignment between client and provider implementations.

Common route sets in current implementations:

- protocol route set: `/ivxp/catalog`, `/ivxp/request`, `/ivxp/deliver`, `/ivxp/status/{order_id}`, `/ivxp/download/{order_id}`
- sdk workflow route set: `/ivxp/orders/{orderId}/*` in some SDK flows

Keep both sides on one explicit contract, or provide a compatibility layer.

## 7. Testing Strategy

- unit tests for mapping and validation
- integration tests against provider endpoint
- interop tests across adapter families and language implementations

## 8. Release Checklist

- types compile with no errors
- integration and interop tests pass
- docs describe exact adapter package versions
- known compatibility constraints are documented

## References

- [Adapter Quickstart](./adapter-quickstart.md)
- [Existing Adapter Development Guide](../adapter-development-guide.md)
- [Protocol Compatibility](../protocol/compatibility.md)
