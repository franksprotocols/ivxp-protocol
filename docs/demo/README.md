# IVXP Protocol - 10-Minute Demo Guide

A step-by-step walkthrough of the IVXP protocol: from wallet setup to purchasing AI services with on-chain USDC payments and cryptographic verification.

> **Scope**: This is a demo walkthrough guide. It assumes you are running services locally
> or have already deployed them. For deployment instructions, see Story 8.7 (Create Deployment Scripts)
> and the deployment configuration templates in `apps/demo-provider/railway.toml` and `apps/hub/vercel.json`.

**Total time**: ~10 minutes (first run) | ~5 minutes (returning user)

---

## Prerequisites

Before starting, ensure you have:

- [ ] MetaMask, Rainbow, or another EVM-compatible wallet installed
- [ ] Base Sepolia network added to your wallet
- [ ] ~0.01 ETH on Base Sepolia (for gas fees)
- [ ] ~5 USDC on Base Sepolia (for service purchases)
- [ ] Modern web browser (Chrome, Firefox, Brave)

> New to testnet setup? See the **Detailed Prerequisites** section below.

---

## Part 1: Setup (2 minutes)

### Step 1: Get Testnet Tokens (~90 seconds)

1. **Get ETH for gas fees**
   - Visit [Alchemy Base Sepolia Faucet](https://www.alchemy.com/faucets/base-sepolia)
   - Paste your wallet address
   - Request 0.1 ETH

2. **Get USDC for service payments**
   - Visit [Circle USDC Faucet](https://faucet.circle.com)
   - Select "Base Sepolia" network
   - Request 10 USDC

### Step 2: Open IVXP Hub (~30 seconds)

1. Navigate to the Hub URL (local: `http://localhost:3000`, or your deployed URL -- see **Quick Reference** below)
2. Click "Connect Wallet" in the top navigation
3. Approve the connection in your wallet
4. If prompted, switch to Base Sepolia network

> **Tip**: The Hub auto-detects your network and prompts to switch if needed.

---

## Part 2: Explore Services (2 minutes)

### Step 3: Browse the Marketplace (~60 seconds)

1. Click "Marketplace" in the navigation bar
2. View the available services from registered providers
3. Note the two demo services:
   - **Text Echo** - $0.10 USDC - Echoes your input with cryptographic verification
   - **Image Generator** - $1.50 USDC - Generates a placeholder image from your prompt

### Step 4: View Service Details (~60 seconds)

1. Click on the "Text Echo" service card
2. Review the service description and pricing
3. Check the estimated delivery time (~36 seconds)
4. Note the input requirements (text description)

---

## Part 3: Purchase Services (4 minutes)

### Step 5: Buy Text Echo Service (~120 seconds)

This is the core IVXP flow. Follow each step carefully:

1. Click "Request Service"
2. Enter text: `Hello IVXP Protocol!`
3. Click "Get Quote"
4. Review the quote:
   - Order ID (format: `ivxp-{uuid}`)
   - Price: 0.10 USDC
   - Provider wallet address
5. Click "Pay with USDC"
6. **Wallet interaction 1**: Approve USDC spend (if first time)
7. **Wallet interaction 2**: Confirm the payment transaction
8. **Wallet interaction 3**: Sign identity message (EIP-191)
9. Wait for delivery (~5 seconds)
10. View the echoed result with content hash verification

> **What just happened?** The protocol executed a complete cycle:
> `quoted -> paid -> processing -> delivered`

### Step 6: Buy Image Generation (~120 seconds)

1. Return to the marketplace
2. Select "Image Generator"
3. Enter prompt: `IVXP Protocol Logo`
4. Follow the same payment flow (steps 3-9 above)
5. View/download the generated image

---

## Part 4: Protocol Deep Dive (2 minutes)

### Step 7: Protocol Inspector (~120 seconds)

The Protocol Inspector reveals the cryptographic internals of each transaction:

1. Open the Protocol Inspector panel (available on the Playground page)
2. Locate your most recent order by `order_id`
3. Click the `tx_hash` to view the on-chain transaction on BaseScan
4. Examine the `signature` field (EIP-191 wallet signature)
5. Verify the `content_hash` of the deliverable (SHA-256)
6. Review the SDK event stream showing state transitions:
   ```
   quoted -> paid -> processing -> delivered
   ```

> **Key insight**: Every step is cryptographically verifiable. The content hash
> proves the deliverable hasn't been tampered with, and the signature proves
> the buyer's identity.

---

## Congratulations!

You've completed the IVXP Protocol demo. You now understand:

- Web3 wallet connectivity and network switching
- On-chain USDC payments on Base L2
- EIP-191 cryptographic identity signing
- Service request and delivery flow
- Protocol transparency and verification via content hashing

**Next Steps**:
- Try the Playground page for a streamlined testing experience
- Explore the advanced scenarios below (error handling, concurrent orders)
- Use the SDK for programmatic access (`@ivxp/sdk`)
- Run your own Provider node (see `apps/demo-provider/`)

---

## Detailed Prerequisites

### Install a Web3 Wallet

You need an EVM-compatible browser wallet:

| Wallet | Install Link | Notes |
|--------|-------------|-------|
| MetaMask | [metamask.io/download](https://metamask.io/download/) | Most widely used |
| Rainbow | [rainbow.me](https://rainbow.me/) | Mobile-first, clean UX |
| Coinbase Wallet | [coinbase.com/wallet](https://www.coinbase.com/wallet) | Good for beginners |

### Add Base Sepolia Network Manually

If automatic network switching doesn't work:

| Field | Value |
|-------|-------|
| Network Name | Base Sepolia |
| RPC URL | `https://sepolia.base.org` |
| Chain ID | `84532` |
| Currency Symbol | ETH |
| Block Explorer | `https://sepolia.basescan.org` |

In MetaMask: Settings > Networks > Add Network > fill in the values above.

### Add USDC Token to Wallet

If USDC doesn't appear in your wallet balance after using the faucet:

1. Open MetaMask
2. Click "Import tokens"
3. Enter the USDC contract address for Base Sepolia: [`0x036CbD53842c5426634e7929541eC2318f3dCF7e`](https://sepolia.basescan.org/token/0x036CbD53842c5426634e7929541eC2318f3dCF7e)
4. Token symbol: `USDC`, Decimals: `6`

### Alternative Faucets

- ETH: [Coinbase Base Sepolia Faucet](https://portal.cdp.coinbase.com/products/faucet)
- ETH: [QuickNode Base Sepolia Faucet](https://faucet.quicknode.com/base/sepolia)

---

## Advanced Scenarios

### Error Handling Demonstration

Test how the protocol handles edge cases:

1. **Insufficient USDC balance**
   - Attempt to purchase a service with < 0.10 USDC
   - Observe the "Insufficient Balance" error message
   - The order remains in `quoted` state (no funds lost)

2. **Wrong network**
   - Switch wallet to Ethereum mainnet
   - Attempt to connect to the Hub
   - Observe the "Wrong Network" prompt with auto-switch button

3. **Provider unavailable**
   - If the demo Provider is down, the Hub shows a clear error
   - Orders in `paid` state are safe -- payment is on-chain and verifiable

### Multiple Concurrent Orders

1. Open two browser tabs to the Playground
2. Start a Text Echo purchase in tab 1
3. Start an Image Gen purchase in tab 2
4. Observe both orders processing independently
5. Check the order list to see both completed

### Order History Review

1. Navigate to the Orders page
2. View all past orders with status indicators
3. Click any order to see full details:
   - Order ID, service type, price
   - Transaction hash (on-chain proof)
   - Content hash (deliverable integrity)
   - Timestamps for each state transition

### Protocol Inspector Deep Dive

The Protocol Inspector on the Playground page shows:

- **Event stream**: Real-time SDK events as they fire
- **State machine**: Visual representation of order state transitions
- **Cryptographic proofs**: tx_hash, signature, content_hash
- **Timing data**: How long each phase took

---

## Quick Reference

### Faucets

| Resource | URL |
|----------|-----|
| ETH (Alchemy) | https://www.alchemy.com/faucets/base-sepolia |
| USDC (Circle) | https://faucet.circle.com |

### URLs

> **Note**: The URLs below are placeholders. Replace them with your actual deployment URLs,
> or use `--local` mode with the setup scripts to run everything on localhost.

| Service | URL |
|---------|-----|
| Hub (local) | http://localhost:3000 |
| Demo Provider (local) | http://localhost:3001 |
| Playground (local) | http://localhost:3000/playground |
| Provider Health (local) | http://localhost:3001/health |

Set environment variables to override:
```bash
export HUB_URL="https://your-hub-deployment.vercel.app"
export DEMO_PROVIDER_URL="https://your-provider-deployment.railway.app"
```

### Service Prices

| Service | Price | Delivery Time |
|---------|-------|---------------|
| Text Echo | 0.10 USDC | ~5 seconds |
| Image Gen | 1.50 USDC | ~10 seconds |

### Demo Inputs

| Service | Suggested Input |
|---------|----------------|
| Text Echo | `Hello IVXP Protocol!` |
| Image Gen | `IVXP Protocol Logo` |

### Base Sepolia Network

| Field | Value |
|-------|-------|
| Chain ID | 84532 |
| RPC URL | https://sepolia.base.org |
| Block Explorer | https://sepolia.basescan.org |
| USDC Contract | 0x036CbD53842c5426634e7929541eC2318f3dCF7e |

---

## Troubleshooting

### "Wrong Network" Error

**Problem**: Wallet connected to wrong network.
**Solution**: Click "Switch Network" button in the Hub, or manually switch to Base Sepolia in your wallet settings.

### "Insufficient Balance" Error

**Problem**: Not enough USDC or ETH.
**Solution**: Visit the faucets listed in Quick Reference above. ETH is needed for gas; USDC is needed for service payments.

### Payment Transaction Fails

**Problem**: Gas estimation failed or transaction reverted.
**Solution**:
1. Check you have enough ETH for gas (> 0.001 ETH)
2. Ensure USDC approval was successful (check wallet activity)
3. Try again -- testnet can be flaky

### "Provider Unavailable"

**Problem**: Demo Provider not responding.
**Solution**: Check the health endpoint at the Provider URL `/health`. If it returns `{"status":"ok"}`, the provider is running. If not, wait a few minutes for the service to restart.

### Deliverable Not Appearing

**Problem**: Service processing taking longer than expected.
**Solution**: Wait 30 seconds and refresh the page. Check the order status endpoint. Testnet block times can vary.

### Wallet Won't Connect

**Problem**: "Connect Wallet" button doesn't respond.
**Solution**:
1. Ensure your wallet extension is unlocked
2. Try refreshing the page
3. Clear browser cache and reconnect
4. Try a different browser

### USDC Not Showing in Wallet

**Problem**: Faucet sent USDC but balance shows 0.
**Solution**: Import the USDC token manually (see Detailed Prerequisites above).

---

## Skip-To Sections (Experienced Users)

If you've done the demo before:

- **Skip to Part 3** if wallet is already set up with tokens
- **Skip to Part 4** if you've already purchased services
- **Go to Playground** directly for the fastest testing experience

---

## Local Development Setup

To run the demo locally instead of using deployed services:

```bash
# Clone and install
git clone https://github.com/franksprotocols/ivxp-protocol.git
cd ivxp-protocol
pnpm install

# Build all packages
pnpm build

# Start demo Provider (terminal 1)
# Requires PROVIDER_PRIVATE_KEY in .env
pnpm --filter demo-provider start

# Start Hub (terminal 2)
pnpm --filter hub dev
```

Then use `scripts/setup-demo.sh` for automated setup and `scripts/health-check.sh` to verify everything is running.
