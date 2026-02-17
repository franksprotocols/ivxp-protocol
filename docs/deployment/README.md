# IVXP Deployment Guide

Deployment documentation for the IVXP Hub and Demo Provider.

## Hub Deployment (Vercel)

### Prerequisites

- Node.js >= 20, pnpm >= 9
- Vercel CLI: `npm i -g vercel`
- Vercel account with project configured

### Environment Variables

Set in Vercel dashboard or via `vercel env`:

| Variable                               | Required | Description              |
| -------------------------------------- | -------- | ------------------------ |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Yes      | WalletConnect project ID |
| `NEXT_PUBLIC_DEMO_PROVIDER_URL`        | Yes      | Demo Provider URL        |
| `NEXT_PUBLIC_BASE_RPC_URL`             | No       | Base mainnet RPC URL     |
| `NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL`     | No       | Base Sepolia RPC URL     |

### Quick Deploy

```bash
export VERCEL_TOKEN="your-token"
export VERCEL_ORG_ID="your-org-id"
export VERCEL_PROJECT_ID="your-project-id"

./scripts/deploy/deploy-hub.sh --prod      # production
./scripts/deploy/deploy-hub.sh --preview   # preview
```

### Health Check

```bash
./scripts/health/check-hub.sh --url=https://your-hub.vercel.app
```

### Rollback

```bash
./scripts/deploy/rollback.sh --target=hub
./scripts/deploy/rollback.sh --target=hub --deployment-id=dpl_xxxxx
```

---

## Provider Deployment (Railway)

### Prerequisites

- Node.js >= 20, pnpm >= 9
- Railway CLI: `npm i -g @railway/cli`
- Railway account with project linked

### Environment Variables

Set in Railway dashboard:

| Variable               | Required | Description                              |
| ---------------------- | -------- | ---------------------------------------- |
| `PORT`                 | Yes      | Server port (default: 3001)              |
| `PROVIDER_PRIVATE_KEY` | Yes      | Provider wallet private key (secret)     |
| `NETWORK`              | Yes      | `base-mainnet` or `base-sepolia`         |
| `NODE_ENV`             | Yes      | `production`                             |
| `PROVIDER_NAME`        | No       | Display name                             |
| `CORS_ALLOWED_ORIGINS` | No       | Comma-separated allowed origins          |
| `LOG_LEVEL`            | No       | `fatal\|error\|warn\|info\|debug\|trace` |
| `RATE_LIMIT_MAX`       | No       | Max requests per window per IP           |
| `RATE_LIMIT_WINDOW_MS` | No       | Rate limit window in ms                  |
| `DB_PATH`              | No       | SQLite path (default: `./orders.db`)     |
| `ORDER_TTL_SECONDS`    | No       | Order TTL in seconds                     |

### Quick Deploy

```bash
export RAILWAY_TOKEN="your-token"

./scripts/deploy/deploy-provider.sh
```

### Database

The provider uses SQLite with embedded schema. The database is auto-initialized on first startup.

```bash
# Initialize locally
./scripts/db/init-provider-db.sh

# Back up
./scripts/db/backup-db.sh

# Initialize on Railway
./scripts/db/init-provider-db.sh --remote
```

### Health Check

```bash
./scripts/health/check-provider.sh --url=https://your-provider.railway.app
```

### Rollback

```bash
./scripts/deploy/rollback.sh --target=provider
```

---

## Environment Configuration Checklist

### Before First Deploy

- [ ] Vercel account created and project linked
- [ ] Railway account created and project linked
- [ ] WalletConnect project ID obtained
- [ ] Provider wallet created (never share private key)
- [ ] Base RPC URL configured (or use defaults)
- [ ] All secrets added to platform dashboards (never in code)

### Before Each Deploy

- [ ] All tests passing: `pnpm test -- --run`
- [ ] Build succeeds: `pnpm build`
- [ ] Lint clean: `pnpm lint`
- [ ] Type check passes: `pnpm typecheck`
- [ ] Environment variables up to date
- [ ] Database backup taken (Provider)

### After Deploy

- [ ] Health checks pass
- [ ] Hub loads and wallet connects
- [ ] Provider catalog endpoint responds
- [ ] Purchase flow works end-to-end
- [ ] Logs accessible on platform dashboard
- [ ] Rollback plan verified

---

## Troubleshooting

### Hub Issues

**Build fails on Vercel**

- Check that `vercel.json` build command includes all dependencies
- Verify `pnpm-lock.yaml` is committed
- Check Node.js version matches `engines` in `package.json`

**Blank page after deploy**

- Check browser console for errors
- Verify `NEXT_PUBLIC_*` env vars are set (they must start with `NEXT_PUBLIC_`)
- Clear Vercel build cache: `vercel --force`

**Wallet connection fails**

- Verify `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set correctly
- Check that the domain is allowlisted in WalletConnect dashboard

### Provider Issues

**Health check returns non-200**

- Check Railway logs: `railway logs --service demo-provider`
- Verify `PORT` env var matches Railway's expected port
- Check that the Dockerfile builds successfully

**Database errors**

- Ensure the data directory is writable
- Check `DB_PATH` env var
- For Railway, ensure persistent volume is attached

**CORS errors from Hub**

- Set `CORS_ALLOWED_ORIGINS` to include the Hub domain
- For development: `CORS_ALLOWED_ORIGINS=http://localhost:3000`

**Rate limiting**

- Adjust `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS`
- Default: 100 requests per 60 seconds per IP

### General

**Scripts fail with "command not found"**

- Ensure scripts are executable: `chmod +x scripts/**/*.sh`
- Verify CLI tools are installed: `vercel --version`, `railway --version`

**Dry-run mode**

- All deploy scripts support `DRY_RUN=1` to preview commands:
  ```bash
  DRY_RUN=1 ./scripts/deploy/deploy-hub.sh --prod
  ```

---

## Scripts Reference

| Script                                | Purpose                                     |
| ------------------------------------- | ------------------------------------------- |
| `scripts/deploy/deploy-hub.sh`        | Deploy Hub to Vercel                        |
| `scripts/deploy/deploy-provider.sh`   | Deploy Provider to Railway                  |
| `scripts/deploy/setup-env.sh`         | Set up environment files                    |
| `scripts/deploy/rollback.sh`          | Roll back a deployment                      |
| `scripts/health/check-hub.sh`         | Hub health check                            |
| `scripts/health/check-provider.sh`    | Provider health check                       |
| `scripts/db/init-provider-db.sh`      | Initialize Provider database                |
| `scripts/db/backup-db.sh`             | Back up Provider database                   |
| `scripts/utils/verify-build.sh`       | Pre-deploy build verification               |
| `scripts/utils/monitor-deployment.sh` | Continuous deployment monitoring            |
| `scripts/utils/common.sh`             | Shared utilities (sourced by other scripts) |

## CI/CD Workflows

| Workflow                                | Trigger                   | Target  |
| --------------------------------------- | ------------------------- | ------- |
| `.github/workflows/deploy-hub.yml`      | Release complete / manual | Vercel  |
| `.github/workflows/deploy-provider.yml` | Release complete / manual | Railway |
