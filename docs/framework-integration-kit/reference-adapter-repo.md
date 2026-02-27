# Reference Adapter Repository

This document points to the canonical IVXP adapter implementation and explains how to use it
as a template for building adapters for new frameworks.

---

## Repository Link

The reference adapter is **`@ivxp/adapter-a2a`**, the official Google Agent-to-Agent (A2A) Protocol adapter.

- **GitHub**: https://github.com/franksprotocols/ivxp-protocol/tree/main/packages/adapter-a2a
- **npm**: `@ivxp/adapter-a2a`

This package is the canonical implementation example because it covers both client and provider
roles, includes a complete end-to-end example, and has a full interop test suite.

---

## Repository Structure

```
packages/adapter-a2a/
├── src/
│   ├── client-adapter.ts       # IVXPA2AClientAdapter — wraps IVXPClient for A2A agents
│   ├── provider-adapter.ts     # IVXPA2AProviderAdapter — wraps IVXPProvider for A2A servers
│   ├── types.ts                # Shared types and interfaces
│   └── index.ts                # Public exports
├── tests/
│   ├── client-adapter.test.ts  # Unit tests for the client adapter
│   └── provider-adapter.test.ts# Unit tests for the provider adapter
├── examples/
│   └── basic/
│       ├── run.ts              # End-to-end example script
│       └── README.md           # Example-specific instructions
├── package.json
├── tsconfig.json
└── README.md
```

Key files to study:

| File                           | What it teaches                                          |
| ------------------------------ | -------------------------------------------------------- |
| `src/client-adapter.ts`        | How to wrap `IVXPClient` for a specific framework        |
| `src/provider-adapter.ts`      | How to wrap `IVXPProvider` for a specific framework      |
| `src/types.ts`                 | How to define framework-specific config and result types |
| `examples/basic/run.ts`        | How to wire up a full end-to-end transaction             |
| `tests/client-adapter.test.ts` | How to test adapter logic with mocked SDK internals      |

---

## Running the Interop Test Suite

### Prerequisites

- Node.js ≥ 18
- pnpm ≥ 8 (`npm install -g pnpm`)
- Environment variables set (see below)

### Clone and install

```bash
git clone https://github.com/franksprotocols/ivxp-protocol.git
cd ivxp-protocol
pnpm install
```

### Configure environment variables

```bash
cd packages/adapter-a2a
cp .env.example .env
# Edit .env:
#   IVXP_PRIVATE_KEY=0x...
#   IVXP_NETWORK=base-sepolia
#   IVXP_PROVIDER_URL=https://...
```

### Run the tests

```bash
# Unit tests only (no network required)
pnpm --filter @ivxp/adapter-a2a test

# End-to-end example (requires live provider and funded wallet)
pnpm --filter @ivxp/adapter-a2a example
```

### Interpreting results

- All tests should pass with 0 failures
- Coverage should be ≥ 80% (reported at the end of the test run)
- The end-to-end example should print `Transaction complete!` with a non-null order ID

---

## Using as a Template for a New Framework

### Step 1: Copy the scaffold

```bash
cp -r packages/adapter-a2a packages/adapter-<your-framework>
cd packages/adapter-<your-framework>
```

### Step 2: Update package metadata

Edit `package.json`:

```json
{
  "name": "@ivxp/adapter-<your-framework>",
  "description": "IVXP adapter for <Your Framework>"
}
```

### Step 3: Implement the client adapter

In `src/client-adapter.ts`, replace A2A-specific logic with your framework's patterns:

```typescript
import { IVXPClientAdapter } from "@ivxp/sdk";

export class IVXPYourFrameworkClientAdapter implements IVXPClientAdapter {
  // Wrap IVXPClient methods to match your framework's calling conventions
}
```

### Step 4: Implement the provider adapter (optional)

In `src/provider-adapter.ts`, wrap `IVXPProvider` to expose your framework's server interface.

### Step 5: Write tests

Mirror the test structure in `tests/client-adapter.test.ts`. Mock `IVXPClient` at the boundary —
do not make real network calls in unit tests.

### Step 6: Validate with the conformance checklist

Run through the [Conformance Checklist](./conformance-checklist.md) before publishing.

### Step 7: Publish

```bash
npm publish --access public
```

For detailed implementation guidance, see the [Adapter Development Guide](../adapter-development-guide.md).
