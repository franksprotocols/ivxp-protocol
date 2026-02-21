# IVXP Deployment Guide

Detailed deployment runbook for IVXP Hub (`apps/hub`) and Demo Provider (`apps/demo-provider`).

## 1. Deployment Topology

- Hub: Next.js app on Vercel
- Provider: Express app on Railway
- Networks: Base Mainnet / Base Sepolia only
- Payment token: USDC (6 decimals)

Recommended release order:

1. Deploy Provider first
2. Run Provider health check
3. Deploy Hub with updated provider URL
4. Run Hub health check and end-to-end smoke test

---

## 2. Prerequisites

### 2.1 Local Tooling

- Node.js >= 20
- pnpm >= 9 (repo currently uses pnpm 10)
- `curl`
- Vercel CLI (optional): `npm i -g vercel`
- Railway CLI: `npm i -g @railway/cli`

Quick verify:

```bash
node -v
pnpm -v
# optional when using global install
vercel --version
railway --version
```

### 2.2 Access and Permissions

- Vercel project configured for Hub
- Railway project configured with `demo-provider` service
- WalletConnect Project ID (for Hub wallet connection)
- Provider wallet private key (for Provider signing/payment verification)

### 2.3 Vercel Project Settings (Hub)

Recommended settings for monorepo deployment:

- Framework Preset: `Next.js`
- Root Directory: `apps/hub`
- Output Directory: `.next` (or leave empty for Next.js default)

Important:

- Configure Hub runtime variables in Vercel Dashboard (`Project Settings -> Environment Variables`).
- Do not rely on `vercel.json` `env` secrets references for this project.

---

## 3. First-Time Setup (One-Time)

### 3.1 Install Dependencies

```bash
pnpm install
```

### 3.2 Generate Env Files from Templates

```bash
./scripts/deploy/setup-env.sh
```

This creates:

- `apps/hub/.env.local`
- `apps/demo-provider/.env`

For production provider runtime variables, use:

- `apps/demo-provider/.env.production`

### 3.3 Validate Env Files

```bash
./scripts/deploy/setup-env.sh --validate
```

If validation fails, fix missing/empty variables first.

### 3.4 Required Platform Tokens (for scripts)

```bash
# Vercel
export VERCEL_TOKEN="<token>"
export VERCEL_ORG_ID="<org-id>"
export VERCEL_PROJECT_ID="<project-id>"

# Railway
export RAILWAY_TOKEN="<token>"
# Optional if your Railway service name is not demo-provider
export RAILWAY_SERVICE="<service-name>"
# Optional: env file path for provider variable sync
export PROVIDER_ENV_FILE="apps/demo-provider/.env.production"
```

Tip: keep these in your shell profile or CI secret manager. Never commit them.

### 3.5 Railway Build Config (Monorepo)

This repository uses root-level `railway.toml` to force Dockerfile deploy for provider:

- build builder: `DOCKERFILE`
- dockerfile path: `apps/demo-provider/Dockerfile`
- start command: `node apps/demo-provider/dist/index.js`

Do not remove this file for Railway provider deployments.

---

## 4. Environment Variables Reference

### 4.1 Hub (Vercel)

Set in Vercel Dashboard Project Settings -> Environment Variables.

| Variable                                | Required   | Default                        | Notes                                              |
| --------------------------------------- | ---------- | ------------------------------ | -------------------------------------------------- |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`  | Yes (prod) | empty                          | Empty disables WalletConnect connector             |
| `NEXT_PUBLIC_DEMO_PROVIDER_URL`         | Yes        | none                           | Playground/provider base URL (HTTPS in production) |
| `NEXT_PUBLIC_BASE_RPC_URL`              | No         | `https://mainnet.base.org`     | Base mainnet RPC                                   |
| `NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL`      | No         | `https://sepolia.base.org`     | Base sepolia RPC                                   |
| `NEXT_PUBLIC_USDC_ADDRESS`              | No         | built-in                       | Global USDC override                               |
| `NEXT_PUBLIC_USDC_ADDRESS_BASE_MAINNET` | No         | built-in                       | Mainnet-only USDC override                         |
| `NEXT_PUBLIC_USDC_ADDRESS_BASE_SEPOLIA` | No         | built-in                       | Sepolia-only USDC override                         |
| `NEXT_PUBLIC_PROVIDER_URL`              | No         | `http://localhost:3001`        | Used by some hooks/API calls                       |
| `NEXT_PUBLIC_EXPLORER_URL`              | No         | `https://sepolia.basescan.org` | Explorer link base                                 |

### 4.2 Demo Provider (Railway)

Set in Railway service variables.

| Variable               | Required | Default                 | Validation                       |
| ---------------------- | -------- | ----------------------- | -------------------------------- |
| `PORT`                 | Yes      | `3001`                  | integer `1..65535`               |
| `PROVIDER_PRIVATE_KEY` | Yes      | none                    | `0x` + 64 hex chars              |
| `NETWORK`              | Yes      | `base-sepolia`          | `base-mainnet` or `base-sepolia` |
| `NODE_ENV`             | Yes      | `development`           | use `production` on Railway      |
| `PROVIDER_NAME`        | No       | `IVXP Demo Provider`    | string                           |
| `CORS_ALLOWED_ORIGINS` | No       | `http://localhost:3000` | comma-separated origins          |
| `LOG_LEVEL`            | No       | `info`                  | one of: `fatal,error,warn,info,debug,trace,silent` |
| `RATE_LIMIT_MAX`       | No       | `100`                   | positive integer                 |
| `RATE_LIMIT_WINDOW_MS` | No       | `60000`                 | integer >= `1000`                |
| `DB_PATH`              | No       | `./orders.db`           | file path or `:memory:`          |
| `ORDER_TTL_SECONDS`    | No       | `604800`                | integer >= `60`                  |

Recommended provider env file example:

```dotenv
PORT=3001
NODE_ENV=production
PROVIDER_PRIVATE_KEY=0x<64_hex_chars>
NETWORK=base-sepolia
PROVIDER_NAME="IVXP Demo Provider"
CORS_ALLOWED_ORIGINS=https://your-hub-domain.com
LOG_LEVEL=info
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000
DB_PATH=./orders.db
ORDER_TTL_SECONDS=604800
```

---

## 5. Pre-Deploy Verification

Run before every production release:

```bash
pnpm lint
pnpm typecheck
pnpm test -- --run
pnpm build
```

Or use script-level verification (recommended, matches deployment scripts):

```bash
# For hub
./scripts/utils/verify-build.sh --target=hub

# For provider
./scripts/utils/verify-build.sh --target=provider
```

---

## 6. Deploy Hub (Vercel)

Script: `scripts/deploy/deploy-hub.sh`

CLI resolution behavior:

- If global `vercel` is installed, the script uses it.
- If not installed, the script falls back to `pnpm dlx vercel@latest`.
- For that fallback command only, `engine-strict` is disabled to avoid local Node engine mismatch failures.

### 6.1 Production Deployment

```bash
./scripts/deploy/deploy-hub.sh --prod
```

### 6.2 Preview Deployment

```bash
./scripts/deploy/deploy-hub.sh --preview
```

### 6.3 Optional Flags

- `--skip-build`: skip local verify-build step

Example:

```bash
./scripts/deploy/deploy-hub.sh --prod --skip-build
```

### 6.4 Dry Run

```bash
DRY_RUN=1 ./scripts/deploy/deploy-hub.sh --prod
```

---

## 7. Deploy Provider (Railway)

Script: `scripts/deploy/deploy-provider.sh`

### 7.1 Standard Deployment

```bash
./scripts/deploy/deploy-provider.sh
```

This flow includes:

1. verify-build (`--target=provider`)
2. `railway up --service <service-name>`
3. DB init (`./scripts/db/init-provider-db.sh --remote`)
4. health probe (auto-discovered URL or `PROVIDER_URL`)

To sync provider variables from a local env file before deploy:

```bash
./scripts/deploy/deploy-provider.sh --env-file=apps/demo-provider/.env.production
```

Equivalent two-step flow:

```bash
./scripts/deploy/sync-provider-env.sh \
  --service=ivxp-demo-provider \
  --env-file=apps/demo-provider/.env.production

./scripts/deploy/deploy-provider.sh --service=ivxp-demo-provider
```

Note: `deploy-provider.sh` uses `PROVIDER_URL` as manual health-check override, while
`check-provider.sh` defaults to `DEMO_PROVIDER_URL` if `--url` is not provided.

### 7.2 Optional Flags

- `--skip-build`: skip verify-build
- `--skip-migrate`: skip remote DB init step
- `--service=NAME`: Railway service name (default: `demo-provider`)
- `--env-file=PATH`: sync Railway provider variables from env file before deploy

Example:

```bash
./scripts/deploy/deploy-provider.sh --skip-migrate
# custom Railway service
./scripts/deploy/deploy-provider.sh --service=provider
# sync env file + deploy
./scripts/deploy/deploy-provider.sh --env-file=apps/demo-provider/.env.production
```

### 7.3 Dry Run

```bash
DRY_RUN=1 ./scripts/deploy/deploy-provider.sh
```

---

## 8. Health Check and Smoke Test

### 8.1 Hub Health Check

```bash
./scripts/health/check-hub.sh --url=https://<hub-domain>
```

Checks:

- `/`
- `/playground`
- `/marketplace`
- homepage content-type (`text/html`)

### 8.2 Provider Health Check

```bash
./scripts/health/check-provider.sh --url=https://<provider-domain>
```

Checks:

- `/health` (HTTP + JSON status)
- `/ivxp/catalog` (HTTP + service list)

### 8.3 Continuous Monitoring (optional)

```bash
HUB_URL=https://<hub-domain> \
DEMO_PROVIDER_URL=https://<provider-domain> \
./scripts/utils/monitor-deployment.sh --target=all --interval=30 --count=20
```

---

## 9. Database Operations (Provider)

### 9.1 Local DB Initialization

```bash
./scripts/db/init-provider-db.sh
```

Optional custom path:

```bash
./scripts/db/init-provider-db.sh --db-path=./data/orders.db
```

### 9.2 Remote DB Initialization (Railway)

```bash
./scripts/db/init-provider-db.sh --remote
```

### 9.3 Backup

```bash
./scripts/db/backup-db.sh
```

Optional custom paths:

```bash
./scripts/db/backup-db.sh --db-path=apps/demo-provider/orders.db --output-dir=./backups
```

Note: backup script keeps latest 10 backups automatically.

---

## 10. Rollback Runbook

Script: `scripts/deploy/rollback.sh`

### 10.1 Hub Rollback

```bash
# Roll back to previous production deployment
./scripts/deploy/rollback.sh --target=hub

# Or promote a specific deployment
./scripts/deploy/rollback.sh --target=hub --deployment-id=dpl_xxxxx
```

To auto-verify rollback, set:

```bash
export HUB_URL="https://<hub-domain>"
```

### 10.2 Provider Rollback

```bash
# Redeploy previous version
./scripts/deploy/rollback.sh --target=provider

# Or redeploy a specific deployment id
./scripts/deploy/rollback.sh --target=provider --deployment-id=<deployment-id>
```

To auto-verify rollback, set:

```bash
export PROVIDER_URL="https://<provider-domain>"
```

---

## 11. Recommended Production Release Procedure

1. Freeze merge window for release branch/commit
2. Run pre-deploy verification
3. Back up provider DB
4. Deploy provider and pass provider health check
5. Update/confirm Hub provider URL env points to the correct provider
6. Deploy hub and pass hub health check
7. Execute one end-to-end purchase flow (`quote -> pay -> sign -> deliver`)
8. Monitor logs/health for 15-30 minutes
9. If high-severity issue appears, execute rollback immediately

---

## 12. Troubleshooting

### 12.1 Hub Deployment Issues

- `Required environment variable not set`: check `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
- `Environment Variable ... references Secret ... which does not exist`:
  - set `NEXT_PUBLIC_*` values directly in Vercel Project Environment Variables
  - remove stale `env` secret references from `apps/hub/vercel.json` if present
- `The Next.js output directory ... was not found`:
  - ensure Vercel `Root Directory` is `apps/hub`
  - ensure `outputDirectory` is `.next` (or empty) instead of `apps/hub/.next`
- Vercel deploy succeeds but page fails:
  - verify `NEXT_PUBLIC_*` values in Vercel
  - verify provider URL is reachable over HTTPS
  - redeploy with cache clear if needed: `vercel --force`
- WalletConnect missing on page: `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is empty/invalid

### 12.2 Provider Deployment Issues

- `railway up --service demo-provider` fails:
  - run `railway service status` to list available services
  - retry with `--service=<service-name>` or `RAILWAY_SERVICE=<service-name>`
  - if needed, link a service: `railway service link <service-name>`
- `No start command was found` in Railway build logs:
  - ensure root `railway.toml` exists in repository root
  - ensure Railway deploy uses Dockerfile builder (not default Railpack)
  - confirm `dockerfilePath=apps/demo-provider/Dockerfile`
- Provider health check fails:
  - inspect logs: `railway logs --service <service-name>`
  - validate `PROVIDER_PRIVATE_KEY`, `NETWORK`, `PORT`
  - verify `CORS_ALLOWED_ORIGINS` includes Hub domain
- `PROVIDER_PRIVATE_KEY must be a 0x-prefixed 64-character hex string`:
  - key must match `^0x[0-9a-fA-F]{64}$`
  - if your key is 64 hex chars without prefix, prepend `0x`
  - re-run env sync: `./scripts/deploy/sync-provider-env.sh --service=<service> --env-file=apps/demo-provider/.env.production`
- DB init/backup failures:
  - confirm DB path is writable
  - for backups, install `sqlite3` for best consistency

### 12.3 Script-Level Issues

- `command not found`: install missing CLI or update `PATH`
- Permission denied:

```bash
chmod +x scripts/deploy/*.sh scripts/health/*.sh scripts/db/*.sh scripts/utils/*.sh
```

- Need to inspect generated command flow without execution:

```bash
DRY_RUN=1 <your-script>
```

---

## 13. Scripts Reference

| Script                                | Purpose                                  |
| ------------------------------------- | ---------------------------------------- |
| `scripts/deploy/setup-env.sh`         | Create/validate env files                |
| `scripts/deploy/deploy-hub.sh`        | Deploy Hub to Vercel                     |
| `scripts/deploy/deploy-provider.sh`   | Deploy Provider to Railway               |
| `scripts/deploy/sync-provider-env.sh` | Sync provider env file to Railway vars   |
| `scripts/deploy/rollback.sh`          | Roll back Hub/Provider                   |
| `scripts/utils/verify-build.sh`       | Pre-deployment lint/typecheck/test/build |
| `scripts/utils/monitor-deployment.sh` | Interval health monitoring               |
| `scripts/health/check-hub.sh`         | Hub health checks                        |
| `scripts/health/check-provider.sh`    | Provider health checks                   |
| `scripts/db/init-provider-db.sh`      | Local/remote DB initialization           |
| `scripts/db/backup-db.sh`             | SQLite backup and retention              |

---

## 14. Security Notes

- Never commit `.env`, private keys, or tokens.
- Always store production secrets in Vercel/Railway secret manager.
- Use a dedicated provider wallet with minimum required funds.
- Rotate deployment tokens regularly.
