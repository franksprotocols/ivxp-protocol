---
title: 7. Security Model
description: Signature verification and integrity guarantees.
---

### 7.1 Three Core Security Guarantees

IVXP provides three cryptographic guarantees that hold without trusting any counterparty:

**Guarantee 1 — Payment is unforgeable.**
The Provider reads the blockchain directly to verify the USDC transfer. The Client cannot claim payment without an actual on-chain transaction. The Provider does not trust the `PaymentProof` fields; it verifies them independently.

**Guarantee 2 — Identity is non-repudiable.**
The Client signs the delivery request with their Ethereum private key using EIP-191. The Provider recovers the signer address from the signature and verifies it matches the payment sender. A third party who observes the payment cannot claim the deliverable without the Client's private key.

**Guarantee 3 — Delivery is verifiable.**
The Provider computes `content_hash = "sha256:" + hex(SHA-256(JSON.stringify(deliverable.content)))` and includes it in the `DeliveryResponse`. The Client verifies this hash against the received content. Any tampering in transit is detectable.

### 7.2 EIP-191 Signature Verification

The Provider verifies the Client's signature using this algorithm:

```text
1. expected_message = render_message(signature_profile, request_context)
2. prefixed = "\x19Ethereum Signed Message:\n" + len(expected_message) + expected_message
3. hash = keccak256(prefixed)
4. recovered_address = ecrecover(hash, signature)
5. assert recovered_address == payment_proof.from_address  (case-insensitive)
6. if nonce is present (or required by profile), assert nonce has not been seen before for this order_id
7. assert signed_message == expected_message
8. assert |now() - parse(timestamp)| <= MAX_TIMESTAMP_AGE (300 seconds)
```

`DeliveryRequest.nonce` is an optional extension field. In the strict profile (recommended), nonce is included in `signed_message` and should be at least 16 characters and unique per order. Implementations using a minimal profile must still define replay-protection behavior explicitly in provider docs.

### 7.3 Timestamp Freshness

| Parameter           | Value                   |
| ------------------- | ----------------------- |
| `MAX_TIMESTAMP_AGE` | 300 seconds (5 minutes) |
| `MAX_CLOCK_SKEW`    | 60 seconds (1 minute)   |

Providers must reject messages where the timestamp is older than `now - MAX_TIMESTAMP_AGE` or newer than `now + MAX_CLOCK_SKEW`.

### 7.4 Content Integrity

```text
content_hash = "sha256:" + hex(SHA-256(JSON.stringify(deliverable.content)))
```

- Providers must compute and include `content_hash` in all `DeliveryResponse` messages.
- Clients must verify `content_hash` before processing the deliverable.
- If the hash does not match, the Client must discard the deliverable.

For the complete security specification including threat model and transport requirements, see [security.md](./security.md).

---

