---
title: Provider Conformance Checklist
description: Release checklist for provider implementations and adapter integrations.
---

# Provider Conformance Checklist

Use this checklist before publishing provider endpoints or adapter integrations.

## 1. Installation and Environment

- [ ] adapter package and `@ivxp/sdk` dependency installed
- [ ] TypeScript type resolution passes
- [ ] required environment variables are present at runtime

## 2. Protocol Compliance

- [ ] endpoint surface matches the selected protocol contract
- [ ] request and response payloads validate against schemas
- [ ] state transitions match protocol state machine

## 3. Baseline Transaction Flow

- [ ] catalog retrieval succeeds and returns services
- [ ] quote request succeeds and returns valid `order_id`
- [ ] payment proof is accepted when payment is valid
- [ ] terminal order status is reachable
- [ ] deliverable retrieval succeeds

## 4. Security Controls

- [ ] EIP-191 signature verification enforced
- [ ] payment verification enforces sender/recipient/network checks
- [ ] replay-like requests are rejected
- [ ] malformed external input is rejected explicitly

## 5. Interoperability

- [ ] cross-framework transactions succeed
- [ ] language interop harness passes (where applicable)
- [ ] quoted amount and paid amount remain consistent across both sides

## 6. Operational Readiness

- [ ] health checks and logs are available
- [ ] rate limiting and request-size controls are enabled
- [ ] rollback path is documented

## 7. Documentation

- [ ] public docs reflect current endpoint and payload contract
- [ ] examples run with current package versions
- [ ] migration notes exist for behavior changes

## Related References

- [Existing Framework Conformance Checklist](../framework-integration-kit/conformance-checklist.md)
- [Protocol Error Codes](../protocol/error-codes.md)
