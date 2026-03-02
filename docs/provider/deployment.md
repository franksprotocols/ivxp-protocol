---
title: Provider Deployment
description: Deployment baseline for IVXP providers in staging and production.
---

This page summarizes provider-focused deployment practices. For full platform runbook details, see [Deployment Guide](../deployment/README.md).

## Target Topology

- provider runtime: `apps/demo-provider` (or your provider implementation)
- optional hub runtime: `apps/hub`
- supported networks: Base Mainnet, Base Sepolia
- payment token: USDC (6 decimals)

## Pre-Deploy Checks

Run before release:

```bash
pnpm lint
pnpm typecheck
pnpm test -- --run
pnpm build
```

Optional script-level verification:

```bash
./scripts/utils/verify-build.sh --target=provider
```

## Required Environment Variables

| Variable               | Required | Notes                                 |
| ---------------------- | -------- | ------------------------------------- |
| `PORT`                 | Yes      | provider HTTP port                    |
| `PROVIDER_PRIVATE_KEY` | Yes      | `0x` + 64 hex chars                   |
| `NETWORK`              | Yes      | `base-mainnet` or `base-sepolia`      |
| `NODE_ENV`             | Yes      | use `production` for deployed runtime |
| `CORS_ALLOWED_ORIGINS` | No       | comma-separated allowed origins       |
| `RATE_LIMIT_MAX`       | No       | request limit threshold               |
| `RATE_LIMIT_WINDOW_MS` | No       | request limit window                  |
| `DB_PATH`              | No       | provider storage path                 |
| `ORDER_TTL_SECONDS`    | No       | order retention policy                |

## Release Sequence

1. deploy provider service
2. run provider health checks
3. run one end-to-end transaction smoke test
4. if hub depends on new provider config, deploy hub update

## Health Checks

- provider `/health` endpoint returns healthy status
- protocol endpoints respond with expected method behavior
- payment verification path succeeds on target network

## Rollback Rules

Trigger rollback when:

- provider endpoint cannot serve quote or delivery flow
- payment verification fails for valid transactions
- delivery retrieval fails for completed orders

Rollback checklist:

1. switch traffic to last stable deployment
2. confirm health and smoke transaction
3. preserve logs, tx hashes, and failing order IDs for root-cause analysis

## Security Notes

- keep private keys in secret manager only
- keep CORS scope minimal
- keep rate limiting enabled
- avoid debug logs that expose sensitive runtime values
