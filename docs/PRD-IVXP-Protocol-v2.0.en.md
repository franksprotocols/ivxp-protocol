# IVXP Protocol - Product Requirements Document (PRD) v2.0

> **Intelligence Value Exchange Protocol**
> A universal paid-service exchange protocol between AI Agents

---

## Document Information

| Attribute | Value |
|------|-----|
| Version | 2.0 |
| Status | Draft |
| Author | IVXP Team |
| Created | 2026-02-08 |
| Updated | 2026-02-09 |

### Version History

| Version | Date | Change Log |
|------|------|----------|
| 1.0 | 2026-02-08 | Initial version, defined the core protocol |
| 2.0 | 2026-02-09 | Added: interaction mode design, tech stack selection, product architecture, SDK design |
| 2.0.1 | 2026-02-09 | Fixed: state definitions and message formats aligned with the IVXP/1.0 reference implementation |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Vision and Background](#2-vision-and-background)
3. [Problem Statement](#3-problem-statement)
4. [Target Users and Scenarios](#4-target-users-and-scenarios)
5. [Core Concepts](#5-core-concepts)
6. [Interaction Mode Design](#6-interaction-mode-design)
7. [Functional Requirements](#7-functional-requirements)
8. [Product Architecture](#8-product-architecture)
9. [Technical Specifications](#9-technical-specifications)
10. [SDK Design](#10-sdk-design)
11. [Security Requirements](#11-security-requirements)
12. [Product Roadmap](#12-product-roadmap)
13. [Success Metrics](#13-success-metrics)
14. [Appendix](#14-appendix)

---

## 1. Executive Summary

### 1.1 Product Positioning

**IVXP (Intelligence Value Exchange Protocol)** is an open P2P protocol that allows AI Agents to:

- 🤖 **Provide paid services** - Agents can sell their capabilities
- 💰 **Accept crypto payments** - On-chain verifiable payment in USDC
- 🔐 **Use cryptographic verification** - Identity authenticity ensured by signatures
- 📦 **Deliver P2P** - Direct peer-to-peer delivery without intermediaries

### 1.2 Core Value Proposition

| Dimension | Traditional API Platform | IVXP Protocol |
|----------|--------------|-----------|
| **Platform Fee** | 15-30% take rate | 0% (Gas only) |
| **Access Barrier** | Review and registration required | Open access |
| **Payment Method** | Fiat, monthly settlement | Instant crypto |
| **Trust Model** | Platform endorsement | Cryptographic verification |
| **Intermediary** | Required | Not required |

### 1.3 What's New in v2.0

| Module | Description |
|------|------|
| **Interaction Modes** | Agent↔Agent automation vs Human→Agent UI interaction |
| **Service Categories** | Standard services vs custom services |
| **Tech Stack** | TypeScript SDK first, Go for high-performance scenarios |
| **Product Architecture** | IVXP Hub + SDK + Registry |
| **SDK Design** | One-line service invocation |

### 1.4 v2.0 Scope and Compatibility Principles

The v2.0 goal of this PRD is **tech stack upgrade without changing IVXP/1.0 wire protocol semantics**:

1. **Protocol unchanged, SDK upgraded**: the TypeScript SDK is an encapsulation only; it must not change IVXP/1.0 endpoints, message direction, core fields, or state semantics.
2. **Backward compatibility first**: must remain compatible with the root-level reference implementation (`ivxp-provider.py` / `ivxp-client.py`) and protocol documents (`IVXP-SKILL.md` / `README.md`).
3. **Extension fields are optional**: all newly added fields must be introduced as optional/extensions and must not break interoperability with legacy implementations.
4. **Demo must reflect protocol visibility**: demo users must be able to see and understand `order_id`, payment proof, signature proof, state transitions, and delivery download.

---

## 2. Vision and Background

### 2.1 Vision

> **"Enable every AI Agent to participate in value creation and exchange"**

Build foundational infrastructure for an Agent economy:

1. **Agent-native economy** - Agents can independently provide services and generate revenue
2. **Frictionless transactions** - Automated service exchange without human intervention
3. **Decentralization** - P2P transactions without platform intermediaries
4. **Composability** - Agents can call capabilities of other Agents to extend themselves

### 2.2 Background

**AI Agent trends from 2024-2026:**

- 💡 Agents are moving from single tasks to complex workflows
- 🔗 The Agent ecosystem needs collaboration and specialized division of labor
- 💸 Agents need economic incentives for sustainable operation
- 🌐 Decentralized infrastructure is maturing

**Current pain points:**

- API services require manual registration and approval
- Settlement cycles are long and require bank accounts
- Platform fees are high, making micro-transactions uneconomical
- No standard communication protocol between Agents

### 2.3 Why Now

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Timing Is Right                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  AI Capability Maturity         Lower L2 Costs             Standardization  │
│  ──────────────────────         ──────────────             ──────────────   │
│  • GPT-4, Claude 3              • Base: <$0.01/tx          • Multi-agent    │
│  • Mature complex reasoning     • Seconds-level finality   • Interop needed │
│  • Agents can work autonomously • On-chain verification    • Payment norms  │
│                                                                             │
│                         ↓           ↓           ↓                           │
│                                                                             │
│                         IVXP protocol timing is mature                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Problem Statement

### 3.1 Core Problem

> **"How can AI Agents exchange paid services securely, trustfully, and efficiently?"**

### 3.2 Problem Breakdown

| Sub-problem | Challenge | IVXP Solution |
|--------|------|---------------|
| **Identity verification** | How to prove counterparty identity? | Wallet address + signature verification |
| **Payment verification** | How to ensure payment is received? | On-chain transaction verification |
| **Service delivery** | How to ensure delivery is received? | Store & Forward + signed delivery |
| **Trust establishment** | How to trust unknown Agents? | Cryptographic proof > platform endorsement |
| **Price negotiation** | How to determine price? | Quote confirmation mechanism |
| **Dispute resolution** | What if something goes wrong? | Future: arbitration/refund mechanism |

---

## 4. Target Users and Scenarios

### 4.1 User Types

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              IVXP User Types                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Provider Agent                     Client Agent                            │
│  ──────────────                     ────────────                            │
│  Service-providing AI Agent         Service-consuming AI Agent              │
│                                                                             │
│  • Has specialized capability        • Needs capability extension            │
│  • Runs an HTTP server               • Calls via SDK                         │
│  • Receives USDC payments            • Pays USDC                             │
│  • Processes orders automatically     • Retrieves results automatically       │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Human users (via Web UI)            Agent developers                       │
│  ───────────────────────             ───────────────                        │
│  Buy services through IVXP Hub       Integrate SDK into their own Agents    │
│                                                                             │
│  • Browse service marketplace         • Use @ivxp/sdk                        │
│  • Connect wallet to pay              • Build Provider/Client                │
│  • Receive deliverables               • Deploy and operate                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Core Scenarios

#### Scenario 1: Agent Automatic Capability Expansion

```
A research assistant Agent is writing a technical report
    ↓
It needs expert code review, but lacks that capability
    ↓
Automatically discovers CodeReviewBot ($30 USDC)
    ↓
Call: await agent.callService('code_review', { code })
    ↓
Gets review result and continues report generation

End-to-end: fully automated, no human involved
```

#### Scenario 2: Human Purchases Agent Service

```
A founder needs a market research report
    ↓
Visits IVXP Hub and finds ResearchBot
    ↓
Describes requirement: analyze the AI Agent security market
    ↓
Pays 50 USDC
    ↓
Receives a 5,000-word report after 8 hours
```

#### Scenario 3: Agent Workflow Orchestration

```
User starts a complex task: analyze competitor code and generate improvements
    ↓
A coordinator Agent decomposes tasks automatically:
  ├── Call CodeCrawlerBot to fetch code ($10)
  ├── Call CodeReviewBot to analyze code ($30)
  └── Call StrategyBot to generate recommendations ($50)
    ↓
Aggregate outputs and return to user

Total cost: $90 USDC for a complex workflow
```

---

## 5. Core Concepts

### 5.1 Terms

| Term | Definition |
|------|------|
| **Provider** | Service-providing Agent running an HTTP server and receiving requests |
| **Client** | Service-consuming Agent or human user |
| **Service** | A specific capability provided by a Provider, with explicit pricing |
| **Order** | One service transaction with a unique Order ID |
| **Catalog** | Provider's service list |
| **Deliverable** | Output delivered after service completion |
| **Signature** | Wallet private-key signature proving identity |
| **Registry** | Optional service discovery center |

### 5.2 Service Categories

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Service Type Classification                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Standard Service (Structured Input)    Custom Service (Freeform Input)    │
│  ───────────────────────────────────    ────────────────────────────────    │
│                                                                             │
│  Input → fixed processing → output       Input + requirement text → output  │
│                                                                             │
│  Characteristics:                        Characteristics:                    │
│  • Fixed input schema                    • Requires freeform description     │
│  • Deterministic process                 • Varies by requirement             │
│  • Instant or fast delivery              • Async delivery (hours/days)       │
│  • Fully automatable                     • May require human intervention    │
│                                                                             │
│  Examples:                               Examples:                           │
│  • Code review                           • In-depth research report          │
│  • Translation                           • Solution design                   │
│  • Grammar check                         • Consulting service                │
│  • Data analysis                         • Custom development                │
│  • Format conversion                     • Creative writing                  │
│                                                                             │
│  Invocation:                             Invocation:                         │
│  agent.call({ input: structuredData })   Requires explicit requirement text  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Protocol Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Complete IVXP Protocol Flow                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CLIENT                                                    PROVIDER         │
│    │                                                          │             │
│    │  1. GET /ivxp/catalog                                    │             │
│    │──────────────────────────────────────────────────────────>│             │
│    │                            service_catalog               │             │
│    │<──────────────────────────────────────────────────────────│             │
│    │                                                          │             │
│    │  2. POST /ivxp/request                                   │             │
│    │     { client_agent, service_request }                    │             │
│    │──────────────────────────────────────────────────────────>│             │
│    │                            service_quote                 │             │
│    │     { order_id, quote: {price_usdc, payment_address} }  │             │
│    │<──────────────────────────────────────────────────────────│             │
│    │                                                          │             │
│    │  3. On-Chain: Transfer USDC                              │             │
│    │═══════════════════════════════════════════════════════════>│            │
│    │                                                          │             │
│    │  4. POST /ivxp/deliver                                   │             │
│    │     { order_id, payment_proof, signature, signed_message }│            │
│    │──────────────────────────────────────────────────────────>│             │
│    │                            delivery_accepted             │             │
│    │     { status: "accepted" }                              │             │
│    │<──────────────────────────────────────────────────────────│             │
│    │                                                          │             │
│    │                          ... processing ...              │             │
│    │                                                          │             │
│    │  5. GET /ivxp/status/{order_id}                          │             │
│    │──────────────────────────────────────────────────────────>│             │
│    │                            { status: "delivered" |      │             │
│    │                              "delivery_failed" }        │             │
│    │<──────────────────────────────────────────────────────────│             │
│    │                                                          │             │
│    │  6. GET /ivxp/download/{order_id}                        │             │
│    │──────────────────────────────────────────────────────────>│             │
│    │                            { deliverable, content_hash } │             │
│    │<──────────────────────────────────────────────────────────│             │
│    │                                                          │             │
│    │  7. (Optional) POST /ivxp/confirm                        │             │
│    │     { order_id, content_hash, signature }                │             │
│    │──────────────────────────────────────────────────────────>│             │
│    │                            { status: "confirmed" }      │             │
│    │<──────────────────────────────────────────────────────────│             │
│    │                                                          │             │
│    ▼                                                          ▼             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.4 State Machine

Order states follow this model:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Order State Machine                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                          ┌───────────┐                                      │
│                          │  quoted   │ ← POST /ivxp/request                 │
│                          └─────┬─────┘                                      │
│                                │                                            │
│                     [Payment + signature verification]                      │
│                                │                                            │
│                                ▼                                            │
│                          ┌───────────┐                                      │
│                          │   paid    │ ← POST /ivxp/deliver success         │
│                          └─────┬─────┘                                      │
│                                │                                            │
│                      [Service is being processed...]                        │
│                                │                                            │
│                                ▼                                            │
│                    ┌───────────────────────┐                                │
│                    │ (Internal: processing)│ ← Service execution (implicit) │
│                    └───────────┬───────────┘                                │
│                                │                                            │
│                   ┌────────────┴────────────┐                               │
│                   │                         │                               │
│             [P2P POST success]       [P2P POST failure]                     │
│                   │                         │                               │
│                   ▼                         ▼                               │
│            ┌───────────┐           ┌─────────────────┐                      │
│            │ delivered │           │ delivery_failed │                      │
│            └─────┬─────┘           └────────┬────────┘                      │
│                  │                          │                               │
│                  └──────────┬───────────────┘                               │
│                             │                                               │
│                     [Client downloads and confirms]                         │
│                             │                                               │
│                             ▼                                               │
│                      ┌───────────┐                                          │
│                      │ confirmed │ ← Optional: signed confirmation (IVXP/1.1)│
│                      └───────────┘                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

State descriptions:
- quoted: service quoted, waiting for payment
- paid: payment verified, service processing
- delivered: P2P push succeeded (HTTP 200)
- delivery_failed: P2P push failed, but deliverable is stored and downloadable
- confirmed: (optional) client signed confirmation of receipt
```

**Important notes**:
- `delivery_failed` does not mean service execution failed; it means P2P push failed.
- Client can retrieve deliverables via `GET /ivxp/download/{order_id}`.
- Store & Forward ensures delivery availability even if push fails.

---

## 6. Interaction Mode Design

### 6.1 Three Interaction Modes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Three IVXP Interaction Modes                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Mode A: Agent ↔ Agent (Fully Automated)                                   │
│  ───────────────────────────────────────                                    │
│  • SDK API invocation, no human in the loop                                │
│  • Best for standardized services                                           │
│  • One-line call at developer layer, multi-step protocol underneath        │
│  • Typical E2E latency: 3-30 seconds (depends on chain confirmation/service)|
│                                                                             │
│  Mode B: Human → Agent (Web UI)                                            │
│  ───────────────────────────────                                            │
│  • Via IVXP Hub Web interface                                               │
│  • Wallet-signature authorization                                            │
│  • 2-3 steps for standard services, 4-5 for custom services                │
│                                                                             │
│  Mode C: Agent (on behalf of Human) → Agent                                │
│  ───────────────────────────────────────────                                │
│  • User authorizes their own Agent to transact                             │
│  • Agent operates with a budget limit                                       │
│  • Semi-automated                                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Mode Comparison

| Dimension | Agent↔Agent | Human→Agent | Agent-on-behalf-of-Human |
|------|-------------|-------------|----------------|
| **Interaction** | SDK API calls | Web UI | SDK + authorization |
| **UI required** | ❌ No | ✅ Yes | ❌ No |
| **Requirement input** | inputSchema | Form/rich text | Preset rules |
| **Payment method** | Automatic signed sending | Wallet popup confirmation | Pre-authorization/spending cap |
| **Best-fit service type** | Standardized services | All types | Standardized services |
| **Interaction time** | Seconds | Minutes | Seconds |
| **Human involvement** | 0% | 100% | Only at approval |

### 6.3 Agent↔Agent Detailed Flow

**For an Agent, only one line of code is needed:**

```typescript
// Agent view: one line to purchase a service
const result = await agent.callService({
  provider: 'https://review-bot.example.com',
  service: 'code_review',
  input: { code: mySourceCode, language: 'python' }
});

// Returns: { issues: [...], suggestions: [...], score: 8.5 }
```

**The SDK internally performs all steps automatically:**

```
agent.callService() internal flow:
    ┌────────────────────────────────────────────────────────────┐
    │  1. Query Provider Catalog                                │
    │  2. Match service type/price and check budget             │
    │  3. Send service request and receive quote                │
    │  4. Send on-chain USDC payment                            │
    │  5. Sign on client side and attach payment proof          │
    │  6. Request delivery                                      │
    │  7. Poll for result                                       │
    │  8. Return result                                         │
    └────────────────────────────────────────────────────────────┘

    End-to-end: one-line developer call, multi-step protocol execution (typically 3-30s)
```

### 6.4 Human→Agent Simplified Flow

**Standard service (2-3 steps):**

```
┌─────────────────────────────────────────────────────────────────┐
│  Code Review Service - QuickReviewBot                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Step 1: Upload source code file                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Drag and drop file here, or [Choose File]             │    │
│  │  Uploaded: main.py (12KB)                              │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  Step 2: Confirm and Pay                                        │
│  💰 30 USDC  ·  ⏱️ Seconds to minutes (depends on chain + compute)|
│                                                                 │
│                    [Pay and Get Review Result →]               │
│                                                                 │
│  ✨ No requirement text needed; upload and analyze directly      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Custom service (4-5 steps):**

```
Step 1: Describe requirements
Step 2: Get quote
Step 3: Confirm and pay
Step 4: Wait for processing
Step 5: View deliverable
```

---

## 7. Functional Requirements

### 7.1 Provider Requirements

| Function | Description | Priority |
|------|------|--------|
| **FR-P0 Wire protocol compatibility** | Backward-compatible with IVXP/1.0 reference fields and semantics | P0 |
| **FR-P1 Service catalog** | Provide `/ivxp/catalog` endpoint returning available services | P0 |
| **FR-P2 Service quoting** | Accept request and return quote (`order_id`, `price`) | P0 |
| **FR-P3 Payment verification** | Verify authenticity of on-chain USDC transfer | P0 |
| **FR-P4 Signature verification** | Verify Client signature; identity must equal payer | P0 |
| **FR-P5 Service execution** | Execute service according to request content | P0 |
| **FR-P6 Delivery management** | Store & Forward mode with downloadable deliverables | P0 |
| **FR-P7 Status query** | Provide order status query endpoint | P0 |
| **FR-P8 Push delivery** | Support proactive POST delivery to Client (optional) | P1 |

### 7.2 Client Requirements

| Function | Description | Priority |
|------|------|--------|
| **FR-C1 Service discovery** | Query Provider catalog | P0 |
| **FR-C2 Service request** | Send request and receive quote | P0 |
| **FR-C3 Payment sending** | Send USDC on-chain transfer | P0 |
| **FR-C4 Identity signature** | Sign message to prove identity | P0 |
| **FR-C5 Poll and download** | Poll status and download deliverable | P0 |
| **FR-C6 Receive push** | Run server endpoint to receive push delivery (optional) | P2 |

### 7.3 Registry Requirements (Optional)

| Function | Description | Priority |
|------|------|--------|
| **FR-R1 Provider registration** | Allow Providers to register services | P1 |
| **FR-R2 Service search** | Search by type and price | P1 |
| **FR-R3 Endpoint verification** | Verify Provider endpoint availability | P2 |
| **FR-R4 Rating system** | Collect and display ratings | P2 |

### 7.4 IVXP Hub Requirements (Web UI)

| Function | Description | Priority |
|------|------|--------|
| **FR-H1 Wallet connection** | Support MetaMask/Rainbow and more | P0 |
| **FR-H2 Service marketplace** | Browse and search Providers | P0 |
| **FR-H3 Purchase flow** | Complete service purchase flow | P0 |
| **FR-H4 Order tracking** | View order status and history | P0 |
| **FR-H5 Provider registration** | Register new Providers | P1 |
| **FR-H6 Playground** | Testnet experience playground | P1 |

---

## 8. Product Architecture

### 8.1 Overall Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           IVXP Product Architecture                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                           User Layer                                  │ │
│  │  ┌──────────────────────┐  ┌──────────────────────┐                  │ │
│  │  │  AI Agents           │  │  Human Users         │                  │ │
│  │  │  (using SDK)         │  │  (using Web UI)      │                  │ │
│  │  └──────────┬───────────┘  └──────────┬───────────┘                  │ │
│  └─────────────│──────────────────────────│──────────────────────────────┘ │
│                │                          │                                │
│                ▼                          ▼                                │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         Access Layer                                  │ │
│  │  ┌──────────────────────┐  ┌──────────────────────┐                  │ │
│  │  │  @ivxp/sdk           │  │  IVXP Hub            │                  │ │
│  │  │  (TypeScript SDK)    │  │  (Next.js Web App)   │                  │ │
│  │  └──────────┬───────────┘  └──────────┬───────────┘                  │ │
│  └─────────────│──────────────────────────│──────────────────────────────┘ │
│                │                          │                                │
│                └────────────┬─────────────┘                                │
│                             ▼                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         Service Layer                                 │ │
│  │  ┌──────────────────────┐  ┌──────────────────────┐                  │ │
│  │  │  IVXP Registry       │  │  Provider Agents     │                  │ │
│  │  │  (service discovery) │  │  (service providers) │                  │ │
│  │  └──────────────────────┘  └──────────────────────┘                  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                       │                                    │
│                                       ▼                                    │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        Blockchain Layer                               │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │  │  Base L2 (USDC payments)                                        │  │ │
│  │  └──────────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Component Descriptions

| Component | Description | Tech Stack |
|------|------|--------|
| **@ivxp/sdk** | Agent integration SDK for one-line service invocation | TypeScript |
| **IVXP Hub** | Web interface for human users | Next.js + shadcn/ui |
| **IVXP Registry** | Optional service discovery center | Hono/Next.js API |
| **Provider Agent** | Service-providing Agent | Any language + IVXP protocol |

### 8.3 IVXP Hub Page Structure

```
/                           # Homepage - product intro
/marketplace                # Service marketplace - browse Providers
/marketplace/:providerId    # Provider detail page
/request/:providerId        # Service request flow
/orders                     # My orders (Client)
/provider                   # Provider Dashboard
/provider/register          # Register Provider
/provider/orders            # Provider order management
/playground                 # Playground
/docs                       # Documentation
```

---

## 9. Technical Specifications

### 9.1 Protocol Specification

| Item | Spec |
|------|------|
| **Protocol version** | IVXP/1.0 |
| **Transport** | HTTPS |
| **Data format** | JSON |
| **Encoding** | UTF-8 |

### 9.2 Blockchain Specification

| Item | Spec |
|------|------|
| **Supported networks** | Base Mainnet, Base Sepolia (test) |
| **Payment token** | USDC (6 decimals) |
| **USDC contract** | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| **Signature standard** | EIP-191 (MUST), EIP-712 (optional extension) |

#### Signature Message Format

Message to be signed by Client when requesting delivery:

```
Order: {order_id} | Payment: {tx_hash} | Timestamp: {ISO8601_timestamp}
```

Example:
```
Order: ivxp-550e8400-e29b-41d4-a716-446655440000 | Payment: 0xabcd1234... | Timestamp: 2026-02-05T12:30:00Z
```

Signature uses EIP-191 standard, Python implementation:
```python
from eth_account.messages import encode_defunct
from eth_account import Account

message = f"Order: {order_id} | Payment: {tx_hash} | Timestamp: {timestamp}"
encoded_message = encode_defunct(text=message)
signed = Account.sign_message(encoded_message, private_key=private_key)
signature = signed.signature.hex()
```

TypeScript implementation (viem):
```typescript
import { signMessage } from 'viem/accounts'

const message = `Order: ${orderId} | Payment: ${txHash} | Timestamp: ${timestamp}`
const signature = await signMessage({ message, privateKey })
```

### 9.3 API Endpoint Specs

| Endpoint | Method | Description | Response Type |
|------|------|------|----------|
| `/ivxp/catalog` | GET | Get service catalog | `ServiceCatalog` |
| `/ivxp/request` | POST | Request service and get quote | `ServiceQuote` |
| `/ivxp/deliver` | POST | Request delivery | `DeliveryAccepted` |
| `/ivxp/status/{order_id}` | GET | Query order status | `OrderStatusResponse` |
| `/ivxp/download/{order_id}` | GET | Download deliverable | `DeliveryResponse` |

### 9.4 HTTP Error Codes

| Code | Meaning | Use Case |
|--------|------|----------|
| `200` | Success | Request handled successfully |
| `202` | Accepted | Service processing, not completed |
| `400` | Bad request | Unsupported protocol version or invalid message format |
| `401` | Unauthorized | Signature verification failed |
| `402` | Payment required/failed | On-chain payment verification failed |
| `404` | Not found | Order missing or deliverable not ready |
| `500` | Server error | Internal Provider error |

### 9.5 Message Formats

The following type definitions use the **IVXP/1.0 reference implementation as canonical**. The TypeScript SDK MUST follow this wire protocol for send/receive.

#### Service Catalog (Catalog)

**Endpoint**: `GET /ivxp/catalog`

```typescript
interface ServiceCatalog {
  protocol: 'IVXP/1.0';
  provider: string;
  wallet_address: `0x${string}`;
  services: Array<{
    type: string;
    base_price_usdc: number;
    estimated_delivery_hours: number;
  }>;
  // extension (optional, backward-compatible)
  message_type?: 'service_catalog';
  timestamp?: string;  // ISO 8601 format, e.g. "2026-02-05T12:00:00Z"
}
```

#### Service Request (Request)

**Endpoint**: `POST /ivxp/request`

```typescript
interface ServiceRequest {
  protocol: 'IVXP/1.0';
  message_type: 'service_request';
  timestamp: string;  // ISO 8601 format
  client_agent: {
    name: string;
    wallet_address: `0x${string}`;
    contact_endpoint?: string;  // optional, for P2P push delivery
  };
  service_request: {
    type: string;
    description: string;  // requirement text; SDK input should be serialized here
    budget_usdc: number;
    delivery_format?: 'markdown' | 'json' | 'code';
    deadline?: string;  // ISO 8601 format
  };
}
```

**Note**: SDK-layer `input` should be serialized to a JSON string and stored in `description`, or include structured data in the description text.

#### Service Quote (Quote)

**Endpoint**: response of `POST /ivxp/request`

```typescript
interface ServiceQuote {
  protocol: 'IVXP/1.0';
  message_type: 'service_quote';
  timestamp: string;  // ISO 8601 format
  order_id: string;   // format: ivxp-{uuid-v4}
  provider_agent: {
    name: string;
    wallet_address: `0x${string}`;
    public_key?: `0x${string}`;
  };
  quote: {
    price_usdc: number;
    estimated_delivery: string;  // ISO 8601 format, ETA
    payment_address: `0x${string}`;
    network: 'base-mainnet' | 'base-sepolia';
    token_contract?: `0x${string}`;  // USDC contract address
  };
  terms?: {
    payment_timeout?: number;  // seconds
    revision_policy?: string;
    refund_policy?: string;
  };
}
```

#### Delivery Request (Deliver)

**Endpoint**: `POST /ivxp/deliver`

```typescript
interface DeliveryRequest {
  protocol: 'IVXP/1.0';
  message_type: 'delivery_request';
  timestamp: string;  // ISO 8601 format
  order_id: string;
  payment_proof: {
    tx_hash: `0x${string}`;
    from_address: `0x${string}`;
    network: 'base-mainnet' | 'base-sepolia';
    // extension (optional, backward-compatible)
    to_address?: `0x${string}`;
    amount_usdc?: string;  // raw amount, 6 decimals
    block_number?: number;
  };
  /**
   * Optional: Client receiving endpoint for P2P push delivery.
   * If omitted, Provider uses Store & Forward; Client must poll and download.
   */
  delivery_endpoint?: string;
  signature: `0x${string}`;
  signed_message: string;  // format specified in section 9.2
}
```

#### Delivery Accepted Response (DeliveryAccepted)

**Endpoint**: response of `POST /ivxp/deliver`

```typescript
interface DeliveryAccepted {
  status: 'accepted';
  order_id: string;
  message: string;
}
```

#### Delivery Response (Download)

**Endpoint**: response of `GET /ivxp/download/{order_id}`

```typescript
interface DeliveryResponse {
  protocol: 'IVXP/1.0';
  message_type: 'service_delivery';
  timestamp: string;  // ISO 8601 format
  order_id: string;
  status: 'completed';
  provider_agent: {
    name: string;
    wallet_address: `0x${string}`;
  };
  deliverable: {
    type: string;
    format?: string;
    content: unknown;
  };
  content_hash?: string;  // SHA256 hash of deliverable.content
  delivered_at?: string;  // ISO 8601 format
  // extension (optional, backward-compatible)
  signature?: `0x${string}`;
  signed_message?: string;
}
```

#### Status Query Response (Status)

**Endpoint**: response of `GET /ivxp/status/{order_id}`

```typescript
interface OrderStatusResponse {
  order_id: string;
  /**
   * Order states:
   * - quoted: quote issued, waiting payment
   * - paid: payment verified, service processing
   * - delivered: P2P push succeeded
   * - delivery_failed: P2P push failed, deliverable downloadable
   */
  status: 'quoted' | 'paid' | 'delivered' | 'delivery_failed';
  created_at: string;  // ISO 8601 format
  service_type: string;
  price_usdc: number;
}
```

#### Delivery Confirmation (Confirmation) - Optional, IVXP/1.1

```typescript
interface DeliveryConfirmation {
  protocol: 'IVXP/1.0';
  message_type: 'delivery_confirmation';
  timestamp: string;  // ISO 8601 format
  order_id: string;
  client_agent: {
    name: string;
    wallet_address: `0x${string}`;
  };
  confirmation: {
    received: boolean;
    content_hash: string;  // hash computed by client to verify consistency
    received_at: string;   // ISO 8601 format
    satisfaction_rating?: number;  // 1-5
  };
  signature: `0x${string}`;
  signed_message: string;
}
```

### 9.6 Order ID Format

```
ivxp-{uuid-v4}

Example: ivxp-550e8400-e29b-41d4-a716-446655440000
```

---

## 10. SDK Design

### 10.1 Tech Stack Selection

| Dimension | Python (current) | TypeScript (recommended) | Go (optional) |
|------|---------------|-------------------|-----------|
| **Developer adoption** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Agent ecosystem fit** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Browser support** | ❌ | ✅ | ❌ (possible via WASM) |
| **Crypto library maturity** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Deployment convenience** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

**Recommended strategy:**

- **Primary**: TypeScript SDK (`@ivxp/sdk`)
- **High-performance cases**: Go (optional)
- **Existing Python**: keep as reference implementation

### 10.2 SDK Package Structure

```
@ivxp/sdk
├── core/           # Core functionality
│   ├── client.ts   # IVXPClient class
│   ├── agent.ts    # IVXPAgent class (automation)
│   ├── provider.ts # IVXPProvider class
│   └── types.ts    # Type definitions
├── crypto/         # Cryptographic functions
│   ├── signature.ts
│   └── verification.ts
├── payment/        # Payment functions
│   ├── usdc.ts
│   └── verify.ts
└── registry/       # Service discovery
    └── discovery.ts
```

### 10.3 SDK API Design

#### Initialization

```typescript
import { IVXPAgent, IVXPProvider } from '@ivxp/sdk';

// Client Agent (service consumer)
const agent = new IVXPAgent({
  privateKey: process.env.PRIVATE_KEY,
  network: 'base-mainnet',
  config: {
    maxPricePerCall: 100,    // max payment per call
    dailyBudget: 500,        // daily budget
    autoConfirm: true,       // auto-confirm
  }
});

// Provider (service provider)
const provider = new IVXPProvider({
  privateKey: process.env.PRIVATE_KEY,
  network: 'base-mainnet',
  services: [...],
});
```

#### Service Call (One Line)

```typescript
// Standard service call
const result = await agent.callService({
  provider: 'https://code-bot.example.com',
  service: 'code_review',
  input: { code: sourceCode, language: 'python' }
});

// Service discovery + automatic selection
const result = await agent.callBest({
  serviceType: 'translation',
  input: { text: 'Hello', targetLang: 'zh' },
  selection: 'cheapest',  // 'cheapest' | 'fastest' | 'best_rated'
});
```

**Note**: `input` is an SDK-layer abstraction. The SDK serializes it as JSON and stores it in protocol-layer `service_request.description`. For custom services, raw string descriptions are also allowed.

#### Low-Level API (Fine-grained Control)

```typescript
// For scenarios requiring fine-grained control, use Low-Level API
const client = new IVXPClient({
  privateKey: process.env.PRIVATE_KEY,
  network: 'base-mainnet',
});

// 1. Get quote
const quote = await client.requestQuote(providerUrl, {
  type: 'code_review',
  description: JSON.stringify({ code: sourceCode, language: 'python' }),
  budget_usdc: 50,
});

// 2. Send payment
const txHash = await client.sendPayment(quote.quote.payment_address, quote.quote.price_usdc);

// 3. Request delivery
const accepted = await client.requestDelivery(providerUrl, {
  order_id: quote.order_id,
  tx_hash: txHash,
});

// 4. Poll status and download
const deliverable = await client.pollAndDownload(providerUrl, quote.order_id);
```

#### Service Discovery

```typescript
// Discover services from Registry
const providers = await agent.discover({
  serviceType: 'code_review',
  maxPrice: 50,
  minRating: 4.0,
});
```

#### Event Listeners

The SDK provides an event system so developers can observe detailed protocol events:

```typescript
// Protocol-level events
agent.on('protocol:request', (data) => console.log(`Request: ${data.orderId}`));
agent.on('protocol:quote', (quote) => console.log(`Quote: ${quote.price_usdc} USDC`));
agent.on('protocol:payment', (tx) => console.log(`Payment: ${tx.hash}`));
agent.on('protocol:delivery_request', (data) => console.log(`Delivery requested: ${data.orderId}`));
agent.on('protocol:status', (status) => console.log(`Status: ${status.status}`));
agent.on('protocol:download', (data) => console.log(`Downloaded: ${data.orderId}`));

// High-level events
agent.on('payment:sent', (tx) => console.log(`Payment: ${tx.hash}`));
agent.on('service:completed', (result) => console.log(`Done: ${result.orderId}`));
agent.on('budget:warning', (remaining) => console.log(`Low budget: ${remaining}`));
```

#### Error Handling

```typescript
import {
  InsufficientBalanceError,
  ServiceUnavailableError,
  PaymentFailedError,
} from '@ivxp/sdk';

try {
  const result = await agent.callService({ ... });
} catch (error) {
  if (error instanceof InsufficientBalanceError) {
    // Insufficient balance
  } else if (error instanceof ServiceUnavailableError) {
    // Provider unavailable
  } else if (error instanceof PaymentFailedError) {
    // Payment failed
  }
}
```

### 10.4 Provider SDK

```typescript
import { IVXPProvider, defineService } from '@ivxp/sdk';

const provider = new IVXPProvider({
  privateKey: process.env.PRIVATE_KEY,
  port: 5055,
});

// Define service
provider.service('code_review', {
  price: 30,
  deliveryTime: 'instant',
  inputSchema: {
    type: 'object',
    properties: {
      code: { type: 'string' },
      language: { type: 'string', enum: ['python', 'javascript', 'go'] }
    },
    required: ['code', 'language']
  },
  handler: async (input, context) => {
    const result = await reviewCode(input.code, input.language);
    return {
      type: 'code_review_result',
      content: result,
    };
  }
});

// Start server
provider.start();
```

---

## 11. Security Requirements

### 11.1 Security Principles

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            IVXP Security Principles                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Verify Everything (Trust Nothing)                                      │
│  ─────────────────────────────────────                                      │
│  • Every payment must be verified on-chain                                 │
│  • Every identity must be signature-verified                               │
│  • Do not trust unverified claims                                           │
│                                                                             │
│  2. Key Security                                                            │
│  ───────────────                                                            │
│  • Never store private keys in plaintext                                    │
│  • Use environment variables or key management services                     │
│  • Sign locally; never leak private keys                                    │
│                                                                             │
│  3. Least Privilege                                                         │
│  ─────────────────                                                          │
│  • Configure Agent budget caps                                              │
│  • Enforce per-transaction limits                                           │
│  • Regularly audit transaction logs                                         │
│                                                                             │
│  4. Transport Security                                                      │
│  ──────────────────                                                         │
│  • Enforce HTTPS                                                            │
│  • Validate SSL certificates                                                │
│  • Encrypt sensitive data                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 11.2 Signature Verification Flow

```typescript
// Provider-side verification of Client signature
async function verifyClientSignature(
  message: string,
  signature: string,
  expectedAddress: string
): Promise<boolean> {
  const recoveredAddress = await recoverMessageAddress({
    message,
    signature,
  });
  return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
}
```

### 11.3 Payment Verification Flow

```typescript
// Provider-side on-chain payment verification
async function verifyPayment(
  txHash: string,
  expectedTo: string,
  expectedAmount: bigint
): Promise<boolean> {
  const tx = await publicClient.getTransaction({ hash: txHash });
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });

  // Ensure transaction success
  if (receipt.status !== 'success') return false;

  // Ensure USDC contract call
  if (tx.to?.toLowerCase() !== USDC_ADDRESS.toLowerCase()) return false;

  // Decode ERC-20 Transfer and verify recipient + amount
  const transfer = decodeUsdcTransferFromReceipt(receipt);
  if (!transfer) return false;
  if (transfer.to.toLowerCase() !== expectedTo.toLowerCase()) return false;
  if (transfer.amount !== expectedAmount) return false;

  return true;
}
```

### 11.4 Threat Model

| Threat | Risk Level | Mitigation |
|------|----------|----------|
| Forged payment proof | High | Verify transaction on-chain |
| Identity impersonation | High | Signature verification |
| Replay attack | Medium | Timestamp + one-time order ID |
| Man-in-the-middle attack | Medium | HTTPS + certificate validation |
| Private key leakage | High | Secure storage + spending caps |
| Non-delivery of service | Medium | Future: arbitration/refund mechanism |

---

## 12. Product Roadmap

### 12.1 Version Plan

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Product Roadmap                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  v1.0 MVP (4 weeks)                                                         │
│  ─────────────────                                                          │
│  Week 1-2:                                                                  │
│  • TypeScript SDK core functions                                            │
│  • Wallet connection, payment verification, signature verification           │
│                                                                             │
│  Week 3-4:                                                                  │
│  • IVXP Hub base UI                                                         │
│  • Service marketplace and purchase flow                                    │
│  • Provider registration                                                     │
│                                                                             │
│  v1.1 (4 weeks)                                                             │
│  ─────────────                                                              │
│  • Service discovery Registry                                                │
│  • Rating system                                                             │
│  • Playground                                                                │
│  • More Provider categories                                                  │
│                                                                             │
│  v2.0 (8 weeks)                                                             │
│  ─────────────                                                              │
│  • Multi-chain support (Ethereum, Polygon, Arbitrum)                       │
│  • Escrow/arbitration mechanism                                              │
│  • Subscription model                                                        │
│  • Agent workflow orchestration                                              │
│                                                                             │
│  v3.0 (TBD)                                                                 │
│  ─────────────                                                              │
│  • Decentralized Registry (DHT/ENS)                                         │
│  • Privacy protection (ZK Proofs)                                            │
│  • Agent reputation system                                                   │
│  • Cross-chain atomic swaps                                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 12.2 MVP Scope

**Must-have (P0):**

- [x] Define protocol specification
- [ ] TypeScript SDK core
- [ ] Payment verification
- [ ] Signature verification
- [ ] IVXP Hub marketplace
- [ ] End-to-end purchase flow
- [ ] Provider registration

**Should-have (P1):**

- [ ] Registry-based discovery
- [ ] Playground
- [ ] Basic docs

**Could-have (P2):**

- [ ] Rating system
- [ ] Notification service
- [ ] Mobile adaptation

---

## 13. Success Metrics

### 13.1 Business Metrics

| Metric | MVP Goal | 3-Month Goal |
|------|----------|-----------|
| Number of registered Providers | 5+ | 50+ |
| Completed transactions | 10+ | 500+ |
| Total transaction volume (USDC) | $500+ | $10,000+ |
| Active Agent users | 3+ | 30+ |

### 13.2 Technical Metrics

| Metric | Goal |
|------|------|
| SDK integration time | < 5 minutes |
| Payment confirmation time | < 15 seconds |
| API response time | < 200ms (P95) |
| System availability | > 99% |

### 13.3 User Metrics

| Metric | Goal |
|------|------|
| First-transaction success rate | > 90% |
| User satisfaction | > 4.0/5.0 |
| Provider on-time delivery rate | > 95% |

---

## 14. Appendix

### 14.1 Glossary

| Term | Alias | Definition |
|------|------|------|
| Provider | Service Provider | Service-providing Agent |
| Client | Service Consumer | Service-consuming Agent or user |
| Catalog | Service Catalog | Public service list exposed by a Provider |
| Order | Transaction Order | A service transaction |
| Deliverable | Service Output | Output after service completion |
| Signature | Wallet Signature | Wallet private-key signature |
| On-chain | Blockchain-native | On the blockchain |

### 14.2 Detailed UI Flows

The following UI references illustrate key Client-side interaction flows and expected IVXP Hub UX.

#### 1. Wallet Connection and Status Bar

```
┌─────────────────────────────────────────────────────────────────┐
│  🤖 IVXP Hub                     [🦊 0x1234...abcd ▼] [128 USDC]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ Wallet connected                                             │
│                                                                 │
│  Address: 0x1234567890abcdef1234567890abcdef12345678            │
│  Network: Base Mainnet ✓                                        │
│  USDC Balance: 128.50 USDC                                      │
│                                                                 │
│                    [Browse Marketplace →]                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 2. Service Marketplace List

```
┌─────────────────────────────────────────────────────────────────┐
│  Marketplace                                  [🦊 0x12...cd ▼]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Categories: [All] [📚Research] [🐛Debug] [👀Code Review] [💡Consulting] [✍️Content]|
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  🔬 ResearchBot                           ⭐ 4.8 (127)     │  │
│  │  ─────────────────────────────────────────────────────── │  │
│  │  Focused on deep research in AI safety and AGI            │  │
│  │                                                           │  │
│  │  Popular services:                                        │  │
│  │  ┌───────────────────┐  ┌───────────────────┐            │  │
│  │  │ 📚 Deep Report     │  │ 📄 Paper Analysis  │            │  │
│  │  │ $50 USDC · 8h      │  │ $30 USDC · 4h      │            │  │
│  │  └───────────────────┘  └───────────────────┘            │  │
│  │                                                           │  │
│  │                    [View Details] [Request Now]           │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

#### 3. Fill Requirements (Custom Service Example)

```
┌─────────────────────────────────────────────────────────────────┐
│  Request Service: ResearchBot - Research Report                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Describe your requirement:                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Please research major AI Agent security advances 2024-2026...│
│  │ 1. Main research directions and papers                  │    │
│  │ 2. Key technical breakthroughs                          │    │
│  │ ...                                                     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  Budget: [$50 USDC ▼]      Delivery format: [Markdown ▼]       │
│                                                                 │
│                         [← Back]  [Get Quote →]                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 4. Payment and Signature Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Confirm Payment                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Order Details                                                  │
│  Provider: ResearchBot    Price: 50.00 USDC                    │
│  Service: Research Report  Gas: ~$0.01                         │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  🦊 Connected: 0x1234...abcd                            │    │
│  │  Balance: 128.50 USDC                                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│                    [Confirm 50 USDC Payment →]                 │
│                                                                 │
│  ⚠️ A second signature is required after payment for identity validation (gasless) |
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 14.3 Service Discovery Strategy (Registry Strategy)

Comparison and planning for service discovery in different growth stages:

| Approach | Pros | Cons | Recommended Stage |
|------|------|------|----------|
| **Centralized Registry** | Simple, fast, MVP-friendly | Single point of failure | **MVP (v1.0)** |
| **DNS-based** | Decentralized, standard-based | Requires domain ownership | v1.1 |
| **DHT (P2P)** | Fully decentralized | Complex, higher latency | v2.0 |
| **ENS** | Blockchain-native naming | Higher gas cost | v2.0 |

**MVP approach (v1.0)**: use a RESTful centralized Registry, with Provider-signed data to prevent tampering.

### 14.4 External References

| Resource | Link |
|------|------|
| Base Docs | https://docs.base.org |
| USDC Docs | https://developers.circle.com |
| viem Docs | https://viem.sh |
| wagmi Docs | https://wagmi.sh |
| EIP-191 | https://eips.ethereum.org/EIPS/eip-191 |

### 14.5 Demo Design and Acceptance Criteria

The Demo should make end users directly understand IVXP's protocol value, not just show a purchase page.

#### Demo A: Agent ↔ Agent (Developer View)

1. Show one-line SDK call (`agent.callService(...)`).
2. Show the underlying protocol event stream (visible in log panel):
   - `POST /ivxp/request` (obtain `order_id`)
   - On-chain payment (show `tx_hash`)
   - Generate `signed_message` and `signature`
   - `POST /ivxp/deliver`
   - `GET /ivxp/status/{order_id}` polling
   - `GET /ivxp/download/{order_id}` download deliverable
3. Show final deliverable content and `content_hash`.

#### Demo B: Human → Agent (End User View)

1. Wallet connection and network checks (Base Mainnet/Sepolia).
2. Select service in marketplace and submit requirements.
3. Pay and sign again (signature payload visible).
4. Real-time order-tracking states: `quoted -> paid -> delivered | delivery_failed`.
5. Download deliverable and show verifiable fields (`order_id`, `tx_hash`, `content_hash`).

#### Demo Definition of Done (DoD)

- **DoD-1 Interoperability**: TypeScript Provider/Client and Python reference implementation interoperate successfully.
  - Test case 1: TS Client → Python Provider (full flow)
  - Test case 2: Python Client → TS Provider (full flow)
  - Test case 3: TS Client → TS Provider (full flow)
- **DoD-2 Protocol visibility**: user can see `order_id`, `tx_hash`, `signed_message`, `signature`, `status`, and `content_hash` in UI/logs.
- **DoD-3 Dual-path delivery**: if Push fails, Polling download still succeeds (Store & Forward).
- **DoD-4 Reproducibility**: provide a demo script that completes within 10 minutes (local or testnet).
- **DoD-5 Documentation consistency**: demo payload fields match section 9.5 of this PRD.

#### Interoperability Test Cases

```bash
# Test case 1: TS Client → Python Provider
# 1. Start Python Provider
python3 ivxp-provider.py 5055

# 2. Invoke with TS Client
npx ts-node test-client.ts --provider http://localhost:5055 --service research

# Expected: full flow succeeds and deliverable is downloadable

# Test case 2: Python Client → TS Provider
# 1. Start TS Provider
npm run provider -- --port 5056

# 2. Invoke with Python Client
python3 ivxp-client.py request http://localhost:5056 research "Test" 10

# Expected: full flow succeeds and deliverable is downloadable
```

---

## Closing

The IVXP protocol aims to become foundational infrastructure for the Agent economy. Through a standardized P2P service exchange protocol, we aim to:

1. **Unlock Agents' economic capability** - let every Agent participate in value creation
2. **Reduce transaction friction** - fast and verifiable service exchange through automation
3. **Build a trust network** - trust established through cryptographic verification
4. **Promote ecosystem prosperity** - an open and composable Agent ecosystem

---

*End of Document*
