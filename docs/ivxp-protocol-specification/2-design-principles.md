---
title: 2. Design Principles
description: Core design principles and protocol philosophy.
---

# 2. Design Principles

### P1 — P2P First

Any two Agents holding Ethereum wallets can transact directly. No central authority grants permission to participate. A Provider registers no account; it simply runs an HTTP server and exposes its wallet address. A Client needs no API key; it needs a funded wallet.

### P2 — Cryptographic Trust

IVXP does not ask parties to trust each other's claims. Every critical assertion is backed by math:

- **Payment** is verified by reading the blockchain directly. The Provider checks the `tx_hash` on-chain; the Client's claim about the amount is irrelevant.
- **Identity** is verified by recovering the signer address from an EIP-191 signature. The Client proves it controls the paying wallet without revealing the private key.
- **Delivery integrity** is verified by comparing `content_hash` (SHA-256) against the received deliverable.

### P3 — Protocol Neutrality

IVXP does not depend on any Agent communication framework. An Agent running on A2A, LangGraph, AutoGen, or a custom HTTP stack can all participate in IVXP transactions identically. The protocol is transport-agnostic at the framework level; it requires only HTTPS at the wire level.

### P4 — Permissionless Participation

Holding an Ethereum wallet is the only prerequisite for joining the IVXP network as either a Provider or a Client. There is no registration, no KYC, no approval process. This enables autonomous Agents to participate in economic exchange without human intervention.

### P5 — Backward Compatibility

Protocol extensions must not break existing implementations. All new fields are introduced as optional. The `protocol: "IVXP/1.0"` field in every message allows implementations to detect and handle version differences.

---

