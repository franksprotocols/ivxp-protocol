---
title: Orders and Delivery
description: Track order states and validate delivery outputs.
---

## Order States

| State             | Meaning                                      |
| ----------------- | -------------------------------------------- |
| `quoted`          | quote issued, waiting for valid payment flow |
| `paid`            | payment verified, processing can start       |
| `processing`      | provider is executing service logic          |
| `delivered`       | output ready and retrievable                 |
| `delivery_failed` | delivery or processing failed                |

## Track an Order

1. query status with `order_id`
2. check transition history
3. stop polling at terminal status

## Download and Validation

After terminal status:

1. call download endpoint for `order_id`
2. verify returned `order_id` equals requested order
3. verify output format and metadata
4. verify `content_hash` when provided

## Delivery Modes

- pull delivery: user polls status then downloads result
- push delivery: provider sends result to callback endpoint if supported

If push fails, pull path may still be available depending on provider behavior.

## Common Issues

| Issue                    | Action                                                    |
| ------------------------ | --------------------------------------------------------- |
| `ORDER_NOT_FOUND`        | verify order source and provider URL                      |
| `DELIVERABLE_NOT_READY`  | continue status polling until terminal state              |
| result integrity concern | re-download and compare hash/metadata                     |

## Related References

- [Protocol State Machine](../protocol/state-machine.md)
- [Protocol Error Codes](../protocol/error-codes.md)
