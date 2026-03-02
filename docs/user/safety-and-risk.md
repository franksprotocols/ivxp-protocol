---
title: Safety and Risk
description: Security checks and risk controls for service users.
---

Use this checklist before, during, and after each purchase flow.

## Before Request

- verify provider identity and service definition
- verify provider URL and expected protocol path contract
- avoid providers that require off-protocol payment channels

## Before Payment

- verify quoted amount and payment address
- verify wallet network matches quote network
- keep a local record of quote data

## Before Signature

- review the message context before signing
- sign only within active purchase flow
- reject signatures unrelated to the current order

## After Delivery

- verify returned `order_id`
- verify `content_hash` integrity value if present
- store tx hash, order ID, and deliverable metadata

## Red Flags

- payment address changes without re-quote
- signer prompt content does not match current order context
- provider asks for direct private key or seed phrase

## Incident Response

1. stop new purchases on suspicious provider
2. preserve evidence (`order_id`, `tx_hash`, payloads)
3. verify chain records on explorer
4. contact provider support with complete evidence

## Related References

- [Protocol Security](../protocol/security.md)
- [Wallet and Payment](./wallet-and-payment.md)
