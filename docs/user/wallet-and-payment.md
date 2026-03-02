---
title: Wallet and Payment
description: Wallet setup and payment verification baseline for service users.
---

# Wallet and Payment

## Supported Networks and Token

| Item          | Value                                                          |
| ------------- | -------------------------------------------------------------- |
| Networks      | `base-mainnet`, `base-sepolia`                                |
| Payment token | USDC                                                           |
| USDC decimals | `6`                                                            |
| Sepolia USDC  | `0x036CbD53842c5426634e7929541eC2318f3dCF7e`                  |

## Wallet Setup Checklist

- [ ] wallet extension installed and unlocked
- [ ] correct Base network selected
- [ ] sufficient ETH for gas
- [ ] sufficient USDC for service payment

## Payment Flow Checklist

1. confirm quote amount and payment address
2. submit transaction from the connected wallet
3. record `tx_hash`
4. verify tx is on expected chain explorer
5. continue with delivery request/signature flow

## Explorer and Faucet References

- Base Sepolia explorer: `https://sepolia.basescan.org`
- Base Sepolia ETH faucet: `https://www.alchemy.com/faucets/base-sepolia`
- Base Sepolia USDC faucet: `https://faucet.circle.com`

## Common Payment Problems

| Problem                 | What to Check                                            |
| ----------------------- | -------------------------------------------------------- |
| Insufficient balance    | ETH gas balance and USDC balance                         |
| Wrong network           | wallet chain ID and Hub network prompt                   |
| Payment tx not found    | tx hash correctness and explorer network                 |
| Payment amount mismatch | quoted price vs transferred amount                       |

## Security Notes

- never approve unknown addresses outside quote context
- never sign unrelated wallet messages during purchase flow
- keep tx hash and order ID for support and dispute investigation

## Related References

- [Protocol Security](../protocol/security.md)
- [Protocol Error Codes](../protocol/error-codes.md)
