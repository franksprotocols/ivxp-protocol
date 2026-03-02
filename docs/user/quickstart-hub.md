---
title: Hub Quick Start
description: Fast path for service users to complete the first purchase and delivery flow.
---

# Hub Quick Start

This guide helps you complete one full purchase flow in IVXP Hub.

## Prerequisites

- EVM wallet installed (MetaMask, Rainbow, Coinbase Wallet)
- wallet connected to Base Sepolia or Base Mainnet
- sufficient balance for gas + USDC payment
- reachable provider through Hub marketplace

## Step 1: Connect Wallet

1. open Hub
2. click `Connect Wallet`
3. approve wallet connection
4. switch to supported Base network if prompted

## Step 2: Discover a Service

1. open `Marketplace`
2. select a service card
3. review provider, price, and service description

## Step 3: Request Quote

1. open service request form
2. fill requirement description
3. submit quote request
4. keep returned `order_id`

## Step 4: Pay and Authorize

1. confirm USDC payment transaction
2. sign required wallet message when prompted
3. wait for provider acceptance

## Step 5: Track Delivery

1. open order details
2. monitor status transition until terminal state
3. download or view delivered content

## Step 6: Verify Result

- verify `order_id` matches quote
- verify transaction hash exists and is inspectable on explorer
- verify deliverable metadata and content integrity fields

## If Something Fails

- payment failure: re-check balance/network and retry
- provider unavailable: retry after provider recovers
- order not found: verify order ID and provider source

## Next

- payment baseline: [Wallet and Payment](./wallet-and-payment.md)
- end-to-end lifecycle details: [Purchase Flow](./purchase-flow.md)
- provider integration contract baseline: [Integration Profiles Quick Reference](../protocol/integration-profiles.md)
