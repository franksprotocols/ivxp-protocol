---
title: Service User FAQ
description: Frequently asked questions for users purchasing services on IVXP.
---

## Do I need a platform account to buy a service?

You need a compatible wallet and supported network access. Payment and verification are protocol-driven.

## What if my quote is higher than my budget?

Do not pay. Adjust request scope and submit a new quote request.

## Why does payment succeed but order does not move forward?

Check provider availability, payment proof submission, and network alignment. Keep `tx_hash` for recovery.

## What does `delivery_failed` mean?

Provider did not complete delivery successfully. Depending on implementation, pull download may still be available.

## How do I verify deliverable integrity?

Compare returned metadata and `content_hash` fields against downloaded content payload context.

## What if I see `ORDER_NOT_FOUND`?

Verify `order_id` came from the same provider endpoint you are querying.

## Why can signature verification fail?

Common causes are wrong wallet account, wrong signed payload context, or mismatched order/payment fields.

## Is one payment transaction reusable for multiple orders?

No. Treat each order as a separate payment proof context.

## Where should I start if I am new?

Start with [Hub Quick Start](./quickstart-hub.md), then read [Purchase Flow](./purchase-flow.md).
