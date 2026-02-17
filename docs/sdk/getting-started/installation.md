# Installation

## Prerequisites

- Node.js 20+ LTS
- pnpm (recommended) or npm
- TypeScript 5.0+

## Install the SDK

```bash
# Using pnpm (recommended)
pnpm add @ivxp/sdk

# Using npm
npm install @ivxp/sdk
```

## Peer Dependencies

The SDK depends on `viem` for Ethereum interactions. Install it alongside the SDK:

```bash
pnpm add viem
```

## TypeScript Configuration

The SDK ships with full TypeScript type definitions. Ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true
  }
}
```

## Subpath Imports

The SDK supports tree-shakeable subpath imports for advanced usage:

```typescript
// Main entry (most common)
import { createIVXPClient, createIVXPProvider } from '@ivxp/sdk';

// Subpath imports (advanced)
import { CryptoService, createCryptoService } from '@ivxp/sdk/crypto';
import { PaymentService } from '@ivxp/sdk/payment';
import { IVXPClient } from '@ivxp/sdk/core';
import { IVXPError } from '@ivxp/sdk/errors';

// Type-only imports (zero runtime cost)
import type { RequestServiceParams, SDKEventMap } from '@ivxp/sdk';
```

## Verify Installation

Create a quick test file to verify the SDK is installed correctly:

```typescript
import { createIVXPClient } from '@ivxp/sdk';

// This will throw if the private key is invalid,
// confirming the SDK is loaded correctly.
try {
  const client = createIVXPClient({
    privateKey: '0x' + 'a'.repeat(64), // test key
    network: 'base-sepolia',
  });
  console.log('SDK installed successfully');
  console.log('Network:', client.getNetwork());
} catch (error) {
  console.error('Installation issue:', error);
}
```

## Next Steps

- [Environment Setup](./environment-setup.md) -- Configure wallets and Base network
- [Quick Start: Client](./quick-start-client.md) -- Request your first service
- [Quick Start: Provider](./quick-start-provider.md) -- Host your first service
