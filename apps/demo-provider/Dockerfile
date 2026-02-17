FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/protocol/package.json packages/protocol/
COPY packages/sdk/package.json packages/sdk/
COPY apps/demo-provider/package.json apps/demo-provider/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/protocol/ packages/protocol/
COPY packages/sdk/ packages/sdk/
COPY apps/demo-provider/ apps/demo-provider/
COPY tsconfig.base.json ./

# Build all packages in order
RUN pnpm --filter @ivxp/protocol build
RUN pnpm --filter @ivxp/sdk build
RUN pnpm --filter @ivxp/demo-provider build

# Production stage
FROM node:20-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder /app/packages/protocol/package.json packages/protocol/
COPY --from=builder /app/packages/protocol/dist/ packages/protocol/dist/
COPY --from=builder /app/packages/sdk/package.json packages/sdk/
COPY --from=builder /app/packages/sdk/dist/ packages/sdk/dist/
COPY --from=builder /app/apps/demo-provider/package.json apps/demo-provider/
COPY --from=builder /app/apps/demo-provider/dist/ apps/demo-provider/dist/

RUN pnpm install --frozen-lockfile --prod

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "apps/demo-provider/dist/index.js"]
