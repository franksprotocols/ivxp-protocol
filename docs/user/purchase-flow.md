---
title: Purchase Flow
description: End-to-end service purchase lifecycle for IVXP users.
---

# Purchase Flow

IVXP purchase lifecycle for service users:

`catalog -> quote -> payment -> deliver -> status -> download`

## Step 1: Service Discovery

- fetch service catalog
- select service type and provider
- verify base price and constraints

## Step 2: Quote Request

- submit service description and budget
- receive `order_id`, price, and payment destination
- stop flow if quote exceeds budget

## Step 3: Payment

- transfer USDC to the quoted payment address
- retain `tx_hash` as proof
- ensure network matches provider quote

## Step 4: Delivery Request

- submit payment proof and signature payload
- receive delivery acceptance response

## Step 5: Status Tracking

- query order status by `order_id`
- wait until `delivered` or `delivery_failed`

## Step 6: Download

- fetch deliverable by `order_id`
- verify metadata and content hash fields when available

## Evidence You Should Keep

- `order_id`
- `tx_hash`
- provider URL
- final order status
- content hash / deliverable metadata

## Failure Branches

- `BUDGET_TOO_LOW` or budget exceeded: revise request
- payment submission failure: retry with validated wallet/network
- `ORDER_NOT_FOUND`: verify provider and order source
- `delivery_failed`: inspect provider response and retry path

## Related References

- [Orders and Delivery](./orders-and-delivery.md)
- [Safety and Risk](./safety-and-risk.md)
- [Protocol Message Formats](../protocol/message-formats.md)
