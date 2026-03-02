---
title: Integration Profiles Quick Reference
description: One-page contract selection guide for provider integrators and service users.
---

This page is the external integration contract checklist for both provider developers and service users.

## 1) Choose Endpoint Profile First

Provider and consumer must agree on one endpoint profile before integration testing.

| Profile | Endpoint Set | Best For | Notes |
| ------- | ------------ | -------- | ----- |
| Wire Profile | `/ivxp/catalog`, `/ivxp/request`, `/ivxp/deliver`, `/ivxp/status/{order_id}`, `/ivxp/download/{order_id}` | Protocol-level interoperability, custom clients, cross-language adapters | Canonical baseline for IVXP/1.0 public docs |
| SDK Workflow Profile | `/ivxp/orders/{orderId}/payment`, `/ivxp/orders/{orderId}`, `/ivxp/orders/{orderId}/deliverable`, `/ivxp/orders/{orderId}/confirm` | SDK-managed orchestration flows | May require adapter/routing compatibility layer |

If profile is not aligned, requests can fail even when payloads are valid.

## 2) Choose Delivery Signature Profile

`DeliveryRequest.signed_message` is required. Rendering format depends on provider profile.

| Signature Profile | Signed Message Rendering | Replay Protection | Recommendation |
| ----------------- | ------------------------ | ---------------- | -------------- |
| Strict (recommended) | `IVXP-DELIVER | Order: ... | Payment: ... | Nonce: ... | Timestamp: ...` | `nonce` (>= 16 chars, unique per order) + timestamp freshness | Default for new public integrations |
| Minimal | Provider-defined deterministic payload binding order/payment context | Provider-defined strategy (must be documented) | Use only when strict profile is not feasible |

## 3) Provider Declaration Template

Publish this contract in public docs before onboarding integrators:

```yaml
endpoint_profile: wire_profile # or sdk_workflow_profile
signature_profile: strict      # or minimal
timestamp_policy:
  max_age_seconds: 300
replay_policy:
  nonce_required: true         # strict usually true
  uniqueness_scope: per_order  # when nonce is used
```

## 4) Provider Integration Checklist

1. Publish supported endpoint profile and signature profile.
2. Validate incoming payloads with protocol schema (`snake_case` on wire).
3. Rebuild expected signed payload from request context and compare exactly.
4. Verify payment on-chain (token, network, sender, recipient, amount, confirmations).
5. Enforce timestamp freshness and replay policy documented in the profile.

## 5) Service User Checklist

1. Confirm provider endpoint profile before implementing client routes.
2. Generate `signed_message` exactly in provider-declared profile.
3. Include `nonce` when provider requires strict profile.
4. Keep local/system time synchronized to avoid freshness rejection.
5. On delivery, verify `content_hash` before consuming output.

## 6) Cross-Reference

- Baseline compatibility rules: [compatibility.md](./compatibility.md)
- Full protocol spec: [IVXP-Protocol-Specification.md](./IVXP-Protocol-Specification.md)
- Message schema details: [message-formats.md](./message-formats.md)
