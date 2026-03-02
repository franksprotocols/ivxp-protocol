---
title: Provider Troubleshooting
description: Diagnose and recover common provider-side failures.
---

Use this page when provider integration fails during quote, payment proof, status, or delivery phases.

## Quick Triage Sequence

1. validate endpoint reachability
2. validate request payload shape
3. validate payment verification path
4. validate signature verification path
5. validate order status and deliverable storage

## Common Failures

| Symptom                         | Probable Cause                                | Action                                              |
| ------------------------------- | --------------------------------------------- | --------------------------------------------------- |
| `SERVICE_NOT_FOUND`             | requested service type not registered         | verify `services[]` config and handler registration |
| `ORDER_NOT_FOUND`               | stale or wrong `order_id`                     | verify quote source and provider URL                |
| `PAYMENT_VERIFICATION_FAILED`   | tx hash invalid, network mismatch, bad amount | verify `tx_hash`, network, recipient and amount     |
| `SIGNATURE_VERIFICATION_FAILED` | signer mismatch or message mismatch           | verify wallet, signed payload and expected signer   |
| `INVALID_ORDER_STATUS`          | duplicate/late delivery request               | query latest order status before re-submitting      |
| `DELIVERABLE_NOT_READY`         | async processing not completed                | poll status until terminal state before download    |

## Endpoint Issues

- if `/ivxp/catalog` or `/ivxp/request` fails, check server boot and route config
- if status/download endpoints fail, verify order store and deliverable store consistency
- if route mismatch occurs, verify client/provider contract (`/ivxp/*` vs `/ivxp/orders/*`)

## Payment Issues

- ensure provider and client use the same `NETWORK`
- ensure quoted price equals expected payment amount in verification
- ensure provider wallet and quote payment address are consistent

## Signature Issues

- confirm EIP-191 signing flow
- confirm signature corresponds to the expected client wallet
- confirm signed message has the same semantic fields used by provider verification

## Delivery Issues

- if push delivery fails, ensure pull download path remains available
- verify `content_hash` creation and storage behavior
- inspect async handler errors from provider logs

## Minimum Incident Record

Capture these fields for each failure:

- `order_id`
- `provider_url`
- `network`
- `tx_hash`
- `error_code`
- timestamp of failure
- resolved action

## Related References

- [Protocol Error Codes](../protocol/error-codes.md)
- [Protocol Security](../protocol/security.md)
- [SDK Error Handling](../sdk/guides/error-handling.md)
