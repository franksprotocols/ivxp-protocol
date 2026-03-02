---
title: 1. What is IVXP
description: Protocol definition and problem statement.
---

**IVXP (Intelligence Value Exchange Protocol) is an independent economic settlement layer for AI Agents.**

It defines a standard for how any two AI Agents — regardless of the communication framework they use — can exchange paid services with cryptographic guarantees: verifiable payment, verifiable identity, and verifiable delivery.

### 1.1 The Problem IVXP Solves

As AI Agents become capable of autonomous work, they need to buy and sell capabilities from each other. The missing piece is not communication (A2A, MCP, and similar protocols handle that) — it is _economic exchange_: how does an Agent pay another Agent for a service, with no trusted intermediary, no platform account, and no manual settlement?

IVXP answers this with a concrete protocol:

- A **Client Agent** discovers a service, receives a price quote, pays in USDC on Base L2, and downloads the result.
- A **Provider Agent** receives the request, issues a quote, verifies the on-chain payment, executes the service, and delivers the result.
- Every step is backed by cryptographic proof. No party needs to trust the other's claims.

### 1.2 What IVXP Is Not

| IVXP is NOT...                             | Because...                                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| A communication protocol                   | It does not define how Agents discover each other or exchange messages in general. Use A2A, MCP, or HTTP for that. |
| An Agent framework                         | It does not define Agent behavior, memory, or tool use.                                                            |
| An extension of A2A or any other framework | IVXP is a peer protocol. A2A, LangGraph, AutoGen, and CrewAI are equal implementors of IVXP, not its hosts.        |
| A centralized payment platform             | There is no IVXP payment processor. Payments settle on-chain via USDC.                                             |

### 1.3 Position in the Agent Protocol Stack

IVXP sits as a **horizontal economic layer** that spans all Agent communication frameworks:

```text
┌─────────────────────────────────────────────────────────────────┐
│                    Agent Application Layer                       │
│                    (Business Logic / Workflows)                  │
├──────────────┬───────────────┬──────────────┬───────────────────┤
│     A2A      │      MCP      │   LangGraph  │  AutoGen / Custom │
│ (comm layer) │  (tool layer) │ (framework)  │  (framework)      │
├──────────────┴───────────────┴──────────────┴───────────────────┤
│                                                                  │
│          IVXP — Independent Economic Settlement Layer            │
│   Service Discovery · Quoting · Payment · Delivery · Integrity  │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│          Blockchain Infrastructure (Base L2 / EVM)               │
│          USDC (ERC-20) · EIP-191 Signatures                      │
└──────────────────────────────────────────────────────────────────┘
```

The correct integration direction is: **frameworks implement IVXP adapters**. IVXP does not become a plugin of any framework. This is the same relationship as banks implementing SWIFT adapters — SWIFT is the standard, banks are the implementors.

---
