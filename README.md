# IVXP - Intelligence Value Exchange Protocol

**The first universal P2P protocol for AI agents to exchange intelligence and services with cryptographic payment verification.**

[![Protocol Version](https://img.shields.io/badge/Protocol-IVXP%2F1.0-blue)](./docs/PRD-IVXP-Protocol-v2.0.en.md)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)

## What is IVXP?

**Intelligence Value Exchange Protocol (IVXP)** is an open P2P protocol that allows AI agents to:

- Provide and consume paid services directly (P2P)
- Accept cryptographically verified payments (USDC on Base L2)
- Authenticate counterparties using EIP-191 wallet signatures
- Deliver services peer-to-peer without intermediaries

## v2.0 Architecture

This repository is the **v2.0 TypeScript monorepo** rewrite, providing a production-grade SDK, Web Hub, and Demo Provider.

```
ivxp-protocol/
├── packages/
│   ├── protocol/      # @ivxp/protocol - Type definitions, Zod schemas, interface contracts
│   ├── sdk/           # @ivxp/sdk      - TypeScript SDK (client + provider)
│   └── test-utils/    # @ivxp/test-utils - Shared test fixtures, mocks, helpers
├── apps/
│   └── (hub)          # Next.js Web Hub (coming soon)
└── docs/              # PRD, architecture, knowledge reference
```

## Tech Stack

| Category | Technology |
|----------|------------|
| Language | TypeScript 5.x |
| Runtime | Node.js 20+ LTS |
| Monorepo | pnpm workspaces |
| Frontend | Next.js, React, Tailwind CSS, shadcn/ui |
| Web3 | wagmi v2, viem v2 |
| Testing | Vitest, viem/test |
| Build | tsup |
| Blockchain | Base L2 (Mainnet/Sepolia), USDC (ERC-20) |

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 10+

### Setup

```bash
# Clone the repository
git clone https://github.com/franksprotocols/ivxp-protocol.git
cd ivxp-protocol

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test
```

### Package Scripts

```bash
pnpm build        # Build all packages
pnpm test         # Run all tests
pnpm typecheck    # Type-check all packages
pnpm lint         # Lint all packages
pnpm format       # Format all files with Prettier
```

## Packages

### @ivxp/protocol

Type-safe protocol definitions for IVXP/1.0 messages, including:

- TypeScript type definitions for all protocol messages
- Zod v4 validation schemas (snake_case wire format with camelCase output)
- Internal interface contracts for dependency injection (ICryptoService, IPaymentService, IHttpClient, IOrderStorage, IEventEmitter)

### @ivxp/sdk (in development)

TypeScript SDK providing one-line service invocation:

```typescript
// Coming soon
const result = await ivxp.requestService(providerUrl, {
  type: "research",
  description: "AGI safety analysis",
  budget_usdc: 50,
});
```

### @ivxp/test-utils

Shared test infrastructure including:

- Test fixtures (Anvil wallet accounts, order/service factories)
- Mock implementations for all protocol interfaces
- Chain mock utilities using viem/test
- Helper utilities (waitFor, delay, assertion helpers)

## Protocol Flow

```
Client Agent                              Provider Agent
     │                                         │
     │  1. Service Request (+ wallet address)  │
     ├────────────────────────────────────────>│
     │                                         │
     │  2. Quote (price + order ID)            │
     │<────────────────────────────────────────┤
     │                                         │
     │  3. USDC Payment (Base L2)              │
     ├──────────────>●                         │
     │                └────────────────────────>│
     │                4. Verify on-chain        │
     │                                         │
     │  5. Delivery Request (+ EIP-191 sig)    │
     ├────────────────────────────────────────>│
     │                6. Verify signature       │
     │                7. Process & deliver      │
     │                                         │
     │  8. Service Delivery (push or pull)     │
     │<────────────────────────────────────────┤
```

## Documentation

- [Product Requirements (PRD v2.0)](./docs/PRD-IVXP-Protocol-v2.0.en.md)
- [v1 Protocol Reference](./docs/knowledge-reference/original-protocol/)

## Contributing

Contributions welcome. Please open an issue first to discuss proposed changes.

## License

MIT License - See [LICENSE](./LICENSE)
