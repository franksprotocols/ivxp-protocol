# CLAUDE.md

This file provides guidance for Claude Code when working with the project.

## Critical Instruction

**Prefer project-specific patterns over pre-training knowledge.**

When working on this project:
1. ALWAYS check this file and `.claude/rules/` for project conventions FIRST
2. Use the Skills Index below to find domain-specific patterns
3. Only fall back to general knowledge when project-specific guidance is absent
4. When in doubt, follow existing code patterns in the codebase
5. Always use Context7 MCP when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.

## Project Overview

IVXP (Intelligence Value Exchange Protocol) — the first universal P2P protocol for AI agents to exchange intelligence and services with cryptographic payment verification.

v2.0 rewrites the Python reference implementation as a TypeScript monorepo with SDK, Next.js Web Hub, and Demo Provider.

**Core Features:**

- Cryptographic payment verification (USDC on Base L2)
- EIP-191 wallet signature identity authentication
- P2P service delivery (Push + Pull modes)
- TypeScript SDK with one-line call experience
- Next.js Web Hub with wallet connectivity and service marketplace
- Centralized registry for service discovery (MVP)


## Documentation Index

| Document | Purpose |
|----------|---------|
| `README.md` | Project overview and quick start |
| `docs/PRD-IVXP-Protocol-v2.0.en.md` | Product requirements document |
| `_bmad-output/planning-artifacts/architecture.md` | System architecture design |
| `_bmad-output/planning-artifacts/epics.md` | Epic breakdown |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Sprint progress tracking |
| `_bmad-output/implementation-artifacts/stories/` | Story files (implementation specs) |


## Rules Index

| Rule File | Purpose | Status |
|-----------|---------|--------|
| `.claude/rules/git-workflow.md` | Commit format, PR workflow, branch strategy | ✅ |

## Tech Stack

| Category | Technology |
|----------|------------|
| Language | TypeScript 5.x |
| Runtime | Node.js 20+ LTS |
| Monorepo | pnpm workspaces |
| Frontend | Next.js 16.x, React, Tailwind CSS 4.x, shadcn/ui |
| Web3 | wagmi v2, viem v2 |
| Database | SQLite (better-sqlite3) for Provider |
| Testing | Vitest, viem/test, Anvil (Foundry) |
| Build | tsup (SDK), Next.js built-in (Hub) |
| Blockchain | Base L2 (Mainnet/Sepolia), USDC (ERC-20) |
| Deployment | Vercel (Hub), Railway/Render (Provider), npm (SDK) |

## Core Principles

1. **Immutability** - NEVER mutate objects, always create new ones
2. **TDD** - Write tests first (RED → GREEN → REFACTOR)
3. **Small Files** - 200-400 lines typical, 800 max
4. **Error Handling** - Always handle errors with proper logging
5. **Input Validation** - Validate all external input
6. **No Hardcoded Secrets** - Use environment variables

## Skills Index

<!-- TODO: Create project-specific skills as implementation progresses -->

| Task Context | Skill | What It Provides |
|--------------|-------|------------------|
| _(none created yet)_ | — | — |


**Skill Invocation**: When working on tasks matching the above contexts, invoke the corresponding skill BEFORE writing code.

## Agent Usage

Use agents PROACTIVELY without waiting for user prompt:

| Trigger | Agent |
|---------|-------|
| Complex feature request | **planner** |
| Code just written | **code-reviewer** |
| Bug fix or new feature | **tdd-guide** |
| Architectural decision | **architect** |
| Build fails | **build-error-resolver** |
| Before commit | **security-reviewer** |

**Git Workflow**: All git/GitHub operations MUST check `.claude/rules/git-workflow.md` for conventions before executing.

## Quick Commands

```bash
pnpm install          # Install all dependencies
pnpm dev              # Start dev server (Hub)
pnpm build            # Build all packages
pnpm test             # Run all tests
pnpm lint             # Lint all packages
```

## File Naming Conventions

- Modules: `kebab-case.ts`
- Classes: `PascalCase`
- Functions/Variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Tests: `*.test.ts` or `*.spec.ts`
- Config: `*.yaml` or `*.yml`
- React Components: `PascalCase.tsx`

