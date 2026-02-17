# Environment Setup

## Wallet Setup

The IVXP SDK uses Ethereum-compatible wallets for identity and payment. You need a private key to sign messages and send USDC payments.

### Generate a Test Wallet

For development on Base Sepolia testnet:

```bash
# Using Node.js
node -e "console.log('0x' + require('crypto').randomBytes(32).toString('hex'))"
```

Or using viem:

```typescript
import { generatePrivateKey } from 'viem/accounts';

const privateKey = generatePrivateKey();
console.log('Private key:', privateKey);
```

**Never commit private keys to source control.** Use environment variables:

```bash
# .env (add to .gitignore)
IVXP_PRIVATE_KEY=0x...your_private_key_here...
```

### Get Your Wallet Address

```typescript
import { createIVXPClient } from '@ivxp/sdk';

const client = createIVXPClient({
  privateKey: process.env.IVXP_PRIVATE_KEY as `0x${string}`,
  network: 'base-sepolia',
});

const address = await client.getAddress();
console.log('Wallet address:', address);
```

## Base Network Configuration

IVXP uses Base L2 for USDC payments. The SDK supports two networks:

| Network | Chain ID | Use Case |
|---------|----------|----------|
| `base-sepolia` | 84532 | Development and testing |
| `base-mainnet` | 8453 | Production |

### Get Testnet USDC

1. Get Base Sepolia ETH from the [Base Faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet)
2. Use a testnet USDC faucet or deploy a mock USDC contract

### Check Your USDC Balance

```typescript
const balance = await client.getBalance();
console.log('USDC balance:', balance);
// Output: "100.500000"
```

## Environment Variables

Recommended environment variables for your project:

```bash
# Required
IVXP_PRIVATE_KEY=0x...          # Your wallet private key

# Optional
IVXP_NETWORK=base-sepolia       # Network (default: base-sepolia)
IVXP_PROVIDER_URL=http://localhost:3001  # Provider URL for testing
```

### Provider URL Configuration

When running examples or tests, set `IVXP_PROVIDER_URL` to point to your provider:

```bash
# Local development
export IVXP_PROVIDER_URL=http://localhost:3001

# Remote provider
export IVXP_PROVIDER_URL=https://demo.ivxp.ai
```

All client examples use `process.env.IVXP_PROVIDER_URL ?? 'http://localhost:3001'` as the default, so you can override it without modifying code.

## Next Steps

- [Quick Start: Client](./quick-start-client.md) -- Request your first service
- [Quick Start: Provider](./quick-start-provider.md) -- Host your first service
