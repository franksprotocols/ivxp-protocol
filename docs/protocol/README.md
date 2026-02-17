# IVXP/1.0 Protocol Documentation

The Intelligence Value Exchange Protocol (IVXP) is a P2P protocol for AI agents to exchange intelligence and services with cryptographic payment verification.

## Documentation Index

| Document | Description |
|----------|-------------|
| [message-formats.md](./message-formats.md) | All request/response message structures with JSON examples |
| [state-machine.md](./state-machine.md) | Order lifecycle state transitions and sequence diagrams |
| [error-codes.md](./error-codes.md) | Complete error code taxonomy with HTTP mappings |
| [security.md](./security.md) | EIP-191 signatures, payment verification, threat model |
| [compatibility.md](./compatibility.md) | Wire format conventions, cross-implementation notes |
| [openapi.yaml](./openapi.yaml) | OpenAPI 3.1 specification |

## Schemas

JSON Schema definitions for all message types are in the `schemas/` directory:

| Schema | Endpoint | Direction |
|--------|----------|-----------|
| [catalog-request.json](./schemas/catalog-request.json) | `GET /ivxp/catalog` | (no body) |
| [catalog-response.json](./schemas/catalog-response.json) | `GET /ivxp/catalog` | Provider -> Client |
| [quote-request.json](./schemas/quote-request.json) | `POST /ivxp/request` | Client -> Provider |
| [quote-response.json](./schemas/quote-response.json) | `POST /ivxp/request` | Provider -> Client |
| [delivery-request.json](./schemas/delivery-request.json) | `POST /ivxp/deliver` | Client -> Provider |
| [delivery-response.json](./schemas/delivery-response.json) | `POST /ivxp/deliver` | Provider -> Client |
| [status-request.json](./schemas/status-request.json) | `GET /ivxp/status/{id}` | (no body) |
| [status-response.json](./schemas/status-response.json) | `GET /ivxp/status/{id}` | Provider -> Client |
| [download-response.json](./schemas/download-response.json) | `GET /ivxp/download/{id}` | Provider -> Client |

## Diagrams

Mermaid diagrams for protocol flows are in the `diagrams/` directory:

| Diagram | Description |
|---------|-------------|
| [state-machine.mmd](./diagrams/state-machine.mmd) | Order state machine |
| [request-sequence.mmd](./diagrams/request-sequence.mmd) | Full request flow |
| [payment-sequence.mmd](./diagrams/payment-sequence.mmd) | Payment verification flow |
| [delivery-sequence.mmd](./diagrams/delivery-sequence.mmd) | Delivery and download flow |

## Quick Reference

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/ivxp/catalog` | Get service catalog |
| `POST` | `/ivxp/request` | Request a service quote |
| `POST` | `/ivxp/deliver` | Submit payment proof and request delivery |
| `GET` | `/ivxp/status/{order_id}` | Check order status |
| `GET` | `/ivxp/download/{order_id}` | Download completed deliverable |

### Order Lifecycle

```
[request] -> quoted -> paid -> processing -> delivered
                                          -> delivery_failed
```

### Technology

- Blockchain: Base L2 (Mainnet / Sepolia)
- Payment: USDC (ERC-20, 6 decimals)
- Identity: EIP-191 wallet signatures
- Transport: HTTPS + JSON
