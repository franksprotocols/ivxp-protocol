/**
 * Security Audit Tests -- Story 8.8
 *
 * Validates all six acceptance criteria for the security audit:
 * 1. EIP-191 signature verification covers all authenticated endpoints
 * 2. No secrets hardcoded in source code
 * 3. 100 req/min rate limit enforced on all public endpoints
 * 4. Zod schemas validate all external input
 * 5. HTTPS enforced for all external communication
 * 6. Replay protection for payment and delivery flows
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

/** Read a file relative to the project root. */
function readFile(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf-8");
}

/** Check if a file exists relative to the project root. */
function fileExists(relativePath: string): boolean {
  return existsSync(resolve(ROOT, relativePath));
}

/** Find all .ts files matching a glob pattern using git ls-files. */
function findSourceFiles(pattern: string): string[] {
  const output = execSync(
    `git -C "${ROOT}" ls-files -- '${pattern}' | grep -v node_modules | grep -v dist | grep -v .next`,
    { encoding: "utf-8" },
  );
  return output.trim().split("\n").filter(Boolean);
}

// ============================================================================
// Scenario 1: EIP-191 signature verification covers all authenticated endpoints
// ============================================================================

describe("AC #1: EIP-191 signature verification coverage", () => {
  it("provider delivery endpoint verifies EIP-191 signatures", () => {
    const providerSrc = readFile("packages/sdk/src/core/provider.ts");
    expect(providerSrc).toContain("cryptoService.verify");
    expect(providerSrc).toContain("SIGNATURE_VERIFICATION_FAILED");
  });

  it("provider delivery endpoint validates signed_message contains order_id", () => {
    const providerSrc = readFile("packages/sdk/src/core/provider.ts");
    expect(providerSrc).toContain("request.signed_message.includes(request.order_id)");
    expect(providerSrc).toContain("INVALID_SIGNED_MESSAGE");
  });

  it("Hub provider registration verifies EIP-191 signatures", () => {
    const routeSrc = readFile("apps/hub/src/app/api/registry/providers/route.ts");
    expect(routeSrc).toContain("verifyRegistrationSignature");
    expect(routeSrc).toContain("SIGNATURE_INVALID");
  });

  it("Hub provider update verifies EIP-191 signatures", () => {
    const routeSrc = readFile("apps/hub/src/app/api/registry/providers/[address]/route.ts");
    expect(routeSrc).toContain("verifyRegistrationSignature");
    expect(routeSrc).toContain("SIGNATURE_INVALID");
  });

  it("Hub ratings submission verifies EIP-191 signatures", () => {
    const serviceSrc = readFile("apps/hub/src/lib/ratings/rating-service.ts");
    expect(serviceSrc).toContain("recoverMessageAddress");
    expect(serviceSrc).toContain("INVALID_SIGNATURE");
  });

  it("signature verification uses case-insensitive address comparison", () => {
    const cryptoSrc = readFile("packages/sdk/src/crypto/signature.ts");
    expect(cryptoSrc).toContain(".toLowerCase()");

    const verifySigSrc = readFile("apps/hub/src/lib/registry/verify-signature.ts");
    expect(verifySigSrc).toContain(".toLowerCase()");

    const ratingSrc = readFile("apps/hub/src/lib/ratings/rating-service.ts");
    expect(ratingSrc).toContain(".toLowerCase()");
  });

  it("CryptoService.verify returns false for invalid inputs (never throws)", () => {
    const cryptoSrc = readFile("packages/sdk/src/crypto/signature.ts");
    // verify() catches all errors and returns false
    expect(cryptoSrc).toMatch(/catch\s*\{[\s\S]*?return false/);
  });
});

// ============================================================================
// Scenario 2: No secrets hardcoded in source code
// ============================================================================

describe("AC #2: Secret management", () => {
  it(".env files are in .gitignore", () => {
    const gitignore = readFile(".gitignore");
    expect(gitignore).toContain(".env");
    expect(gitignore).toContain(".env.*");
    expect(gitignore).toContain("!.env.example");
  });

  it(".env.example files exist for all apps", () => {
    expect(fileExists(".env.example")).toBe(true);
    expect(fileExists("apps/demo-provider/.env.example")).toBe(true);
    expect(fileExists("apps/hub/.env.example")).toBe(true);
  });

  it("no real private keys in source files", () => {
    const sourceFiles = findSourceFiles("**/*.ts");
    const nonTestFiles = sourceFiles.filter(
      (f) =>
        !f.includes(".test.") &&
        !f.includes(".spec.") &&
        !f.includes("__tests__") &&
        !f.includes("test-utils/"),
    );

    for (const file of nonTestFiles) {
      const content = readFile(file);
      // Check for 0x-prefixed 64-char hex strings that look like private keys
      // Exclude known constants (ERC20_TRANSFER_EVENT_TOPIC, USDC addresses)
      const matches = content.match(/0x[a-fA-F0-9]{64}(?![a-fA-F0-9])/g) ?? [];
      for (const match of matches) {
        // Known safe constants
        const knownSafe = [
          "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", // ERC20 Transfer topic
        ];
        if (!knownSafe.includes(match.toLowerCase())) {
          // Verify it's in a regex pattern or type annotation, not a literal key
          const lineWithMatch = content.split("\n").find((line) => line.includes(match));
          const isRegex = lineWithMatch?.includes("REGEX") || lineWithMatch?.includes("/^0x");
          const isComment =
            lineWithMatch?.trimStart().startsWith("//") ||
            lineWithMatch?.trimStart().startsWith("*");
          const isType =
            lineWithMatch?.includes("as `0x${string}`") ||
            lineWithMatch?.includes(": `0x${string}`");
          expect(
            isRegex || isComment || isType,
            `Potential hardcoded secret in ${file}: ${match.slice(0, 10)}...`,
          ).toBe(true);
        }
      }
    }
  });

  it("provider config reads private key from environment variable", () => {
    const configSrc = readFile("apps/demo-provider/src/config.ts");
    expect(configSrc).toContain('process.env["PROVIDER_PRIVATE_KEY"]');
  });

  it("gitignore blocks private key files", () => {
    const gitignore = readFile(".gitignore");
    expect(gitignore).toContain("*.key");
    expect(gitignore).toContain("*.pem");
    expect(gitignore).toContain("*private*");
  });
});

// ============================================================================
// Scenario 3: Rate limiting
// ============================================================================

describe("AC #3: 100 req/min rate limit enforced", () => {
  it("demo-provider applies express-rate-limit middleware", () => {
    const serverSrc = readFile("apps/demo-provider/src/server.ts");
    expect(serverSrc).toContain("rateLimit");
    expect(serverSrc).toContain("config.rateLimitMax");
    expect(serverSrc).toContain("config.rateLimitWindowMs");
  });

  it("demo-provider default rate limit is 100 req/min", () => {
    const configSrc = readFile("apps/demo-provider/src/config.ts");
    expect(configSrc).toContain("DEFAULT_RATE_LIMIT_MAX = 100");
    expect(configSrc).toContain("DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000");
  });

  it("Hub ratings API has rate limiting", () => {
    const ratingsRoute = readFile("apps/hub/src/app/api/ratings/route.ts");
    expect(ratingsRoute).toContain("rateLimiter");
    expect(ratingsRoute).toContain("RATE_LIMIT_MAX_REQUESTS = 100");
    expect(ratingsRoute).toContain("RATE_LIMIT_WINDOW_MS = 60_000");
  });

  it("Hub ratings API returns Retry-After header on 429", () => {
    const ratingsRoute = readFile("apps/hub/src/app/api/ratings/route.ts");
    expect(ratingsRoute).toContain("Retry-After");
    expect(ratingsRoute).toContain("429");
  });

  it("Hub middleware applies rate limiting to all API routes", () => {
    const middlewareSrc = readFile("apps/hub/src/middleware.ts");
    expect(middlewareSrc).toContain("rateLimiter");
    expect(middlewareSrc).toContain('pathname.startsWith("/api/")');
    expect(middlewareSrc).toContain("Retry-After");
    expect(middlewareSrc).toContain("429");
  });

  it("rate limiter implements sliding window algorithm", () => {
    const rateLimiterSrc = readFile("apps/hub/src/lib/ratings/rate-limiter.ts");
    expect(rateLimiterSrc).toContain("timestamps");
    expect(rateLimiterSrc).toContain("windowMs");
    expect(rateLimiterSrc).toContain("maxRequests");
    expect(rateLimiterSrc).toContain("retryAfterMs");
  });
});

// ============================================================================
// Scenario 4: Zod schemas validate all external input
// ============================================================================

describe("AC #4: Input validation with Zod schemas", () => {
  it("demo-provider validates service request body with Zod", () => {
    const serverSrc = readFile("apps/demo-provider/src/server.ts");
    expect(serverSrc).toContain("ServiceRequestBodySchema.safeParse");
  });

  it("demo-provider validates delivery request body with Zod", () => {
    const serverSrc = readFile("apps/demo-provider/src/server.ts");
    expect(serverSrc).toContain("DeliveryRequestBodySchema.safeParse");
  });

  it("Hub registry validates provider registration with Zod", () => {
    const routeSrc = readFile("apps/hub/src/app/api/registry/providers/route.ts");
    expect(routeSrc).toContain("registerProviderBodySchema.parse");
  });

  it("Hub registry validates provider list query with Zod", () => {
    const routeSrc = readFile("apps/hub/src/app/api/registry/providers/route.ts");
    expect(routeSrc).toContain("listProvidersQuerySchema.parse");
  });

  it("Hub registry validates provider update with Zod", () => {
    const routeSrc = readFile("apps/hub/src/app/api/registry/providers/[address]/route.ts");
    expect(routeSrc).toContain("updateProviderBodySchema.parse");
  });

  it("Hub registry validates service search with Zod", () => {
    const routeSrc = readFile("apps/hub/src/app/api/registry/services/search/route.ts");
    expect(routeSrc).toContain("searchServicesQuerySchema.parse");
  });

  it("Hub ratings validates submission with Zod", () => {
    const routeSrc = readFile("apps/hub/src/app/api/ratings/route.ts");
    expect(routeSrc).toContain("submitRatingBodySchema.parse");
  });

  it("demo-provider schemas validate hex addresses", () => {
    const schemasSrc = readFile("apps/demo-provider/src/schemas.ts");
    expect(schemasSrc).toContain("0x[a-fA-F0-9]{40}");
  });

  it("demo-provider schemas validate hex transaction hashes", () => {
    const schemasSrc = readFile("apps/demo-provider/src/schemas.ts");
    expect(schemasSrc).toContain("0x[a-fA-F0-9]{64}");
  });

  it("demo-provider schemas validate EIP-191 signatures", () => {
    const schemasSrc = readFile("apps/demo-provider/src/schemas.ts");
    expect(schemasSrc).toContain("0x[a-fA-F0-9]{130}");
  });

  it("SQLite queries use parameterized statements (no string concatenation)", () => {
    const ordersSrc = readFile("apps/demo-provider/src/db/orders.ts");
    // All SQL uses ? placeholders
    expect(ordersSrc).toContain("VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    expect(ordersSrc).toContain("WHERE order_id = ?");
    // Uses whitelist for dynamic field names
    expect(ordersSrc).toContain("ALLOWED_FIELDS");
  });

  it("provider validates request body size limit", () => {
    const providerSrc = readFile("packages/sdk/src/core/provider.ts");
    expect(providerSrc).toContain("MAX_REQUEST_BODY_SIZE");
    expect(providerSrc).toContain("REQUEST_TOO_LARGE");
  });

  it("ratings review text is sanitized for XSS", () => {
    const serviceSrc = readFile("apps/hub/src/lib/ratings/rating-service.ts");
    expect(serviceSrc).toContain("sanitizeReviewText");
    expect(serviceSrc).toContain("&lt;");
    expect(serviceSrc).toContain("&gt;");
    expect(serviceSrc).toContain("&quot;");
  });
});

// ============================================================================
// Scenario 5: HTTPS enforced for all external communication
// ============================================================================

describe("AC #5: Transport security", () => {
  it("Hub registry requires HTTPS for provider endpoint URLs", () => {
    const schemasSrc = readFile("apps/hub/src/lib/registry/schemas.ts");
    expect(schemasSrc).toContain('startsWith("https://", "endpoint_url must use HTTPS")');
  });

  it("Hub middleware enforces HTTPS in production", () => {
    const middlewareSrc = readFile("apps/hub/src/middleware.ts");
    expect(middlewareSrc).toContain("x-forwarded-proto");
    expect(middlewareSrc).toContain('protocol = "https:"');
  });

  it("Hub middleware includes HSTS header", () => {
    const middlewareSrc = readFile("apps/hub/src/middleware.ts");
    expect(middlewareSrc).toContain("Strict-Transport-Security");
    expect(middlewareSrc).toContain("max-age=31536000");
  });

  it("next.config disables X-Powered-By header", () => {
    const configSrc = readFile("apps/hub/next.config.ts");
    expect(configSrc).toContain("poweredByHeader: false");
  });

  it("middleware includes X-Content-Type-Options header", () => {
    const middlewareSrc = readFile("apps/hub/src/middleware.ts");
    expect(middlewareSrc).toContain("X-Content-Type-Options");
    expect(middlewareSrc).toContain("nosniff");
  });

  it("middleware includes X-Frame-Options header", () => {
    const middlewareSrc = readFile("apps/hub/src/middleware.ts");
    expect(middlewareSrc).toContain("X-Frame-Options");
    expect(middlewareSrc).toContain("DENY");
  });

  it("middleware includes Content-Security-Policy header", () => {
    const middlewareSrc = readFile("apps/hub/src/middleware.ts");
    expect(middlewareSrc).toContain("Content-Security-Policy");
    expect(middlewareSrc).toContain("default-src 'self'");
  });

  it("provider SSRF protection blocks private IPs for delivery URLs", () => {
    const providerSrc = readFile("packages/sdk/src/core/provider.ts");
    expect(providerSrc).toContain("PRIVATE_IPV4_PATTERNS");
    expect(providerSrc).toContain("INVALID_DELIVERY_URL");
    expect(providerSrc).toContain("localhost");
  });
});

// ============================================================================
// Scenario 6: Replay protection
// ============================================================================

describe("AC #6: Replay protection", () => {
  it("provider rejects duplicate tx_hash in delivery requests", () => {
    const providerSrc = readFile("packages/sdk/src/core/provider.ts");
    expect(providerSrc).toContain("usedTxHashes");
    expect(providerSrc).toContain("Duplicate payment: this transaction hash has already been used");
  });

  it("provider tracks used tx_hashes case-insensitively", () => {
    const providerSrc = readFile("packages/sdk/src/core/provider.ts");
    expect(providerSrc).toContain("txHashLower");
    expect(providerSrc).toContain(".toLowerCase()");
  });

  it("provider validates signed_message contains order_id (prevents cross-order replay)", () => {
    const providerSrc = readFile("packages/sdk/src/core/provider.ts");
    expect(providerSrc).toContain("request.signed_message.includes(request.order_id)");
  });

  it("provider rejects delivery for non-quoted orders (prevents status replay)", () => {
    const providerSrc = readFile("packages/sdk/src/core/provider.ts");
    expect(providerSrc).toContain('order.status !== "quoted"');
    expect(providerSrc).toContain("INVALID_ORDER_STATUS");
  });

  it("Hub registration signature has timestamp-based expiry", () => {
    const verifySrc = readFile("apps/hub/src/lib/registry/verify-signature.ts");
    expect(verifySrc).toContain("TIMESTAMP_TOLERANCE_MS");
    expect(verifySrc).toContain("5 * 60 * 1000");
  });

  it("Hub ratings have timestamp-based replay prevention", () => {
    const serviceSrc = readFile("apps/hub/src/lib/ratings/rating-service.ts");
    expect(serviceSrc).toContain("TIMESTAMP_TOLERANCE_MS");
    expect(serviceSrc).toContain("TIMESTAMP_EXPIRED");
  });

  it("Hub ratings prevent duplicate submissions", () => {
    const serviceSrc = readFile("apps/hub/src/lib/ratings/rating-service.ts");
    expect(serviceSrc).toContain("isDuplicateRating");
    expect(serviceSrc).toContain("DUPLICATE_RATING");
  });

  it("provider validates network matches to prevent cross-network replay", () => {
    const providerSrc = readFile("packages/sdk/src/core/provider.ts");
    expect(providerSrc).toContain("NETWORK_MISMATCH");
    expect(providerSrc).toContain("request.payment_proof.network !== this.network");
  });

  it("IVXP message format includes order_id and tx_hash for binding", () => {
    const cryptoSrc = readFile("packages/sdk/src/crypto/signature.ts");
    expect(cryptoSrc).toContain("Order: ${params.orderId}");
    expect(cryptoSrc).toContain("Payment: ${params.txHash}");
    expect(cryptoSrc).toContain("Timestamp:");
  });
});

// ============================================================================
// OWASP Top 10 supplementary checks
// ============================================================================

describe("OWASP supplementary checks", () => {
  it("error responses do not leak internal details", () => {
    const providerSrc = readFile("packages/sdk/src/core/provider.ts");
    expect(providerSrc).toContain('"Internal server error"');

    const serverSrc = readFile("apps/demo-provider/src/server.ts");
    expect(serverSrc).toContain('"Internal server error"');
  });

  it("Hub API routes return generic error for unexpected failures", () => {
    const registryRoute = readFile("apps/hub/src/app/api/registry/providers/route.ts");
    expect(registryRoute).toContain('"An unexpected error occurred."');

    const ratingsRoute = readFile("apps/hub/src/app/api/ratings/route.ts");
    expect(ratingsRoute).toContain('"An unexpected error occurred."');
  });

  it("Hub ratings sanitize error messages for logging", () => {
    const ratingsRoute = readFile("apps/hub/src/app/api/ratings/route.ts");
    expect(ratingsRoute).toContain("sanitizeErrorForLog");
  });

  it("provider binds to loopback by default (not 0.0.0.0)", () => {
    const providerSrc = readFile("packages/sdk/src/core/provider.ts");
    expect(providerSrc).toContain('DEFAULT_HOST = "127.0.0.1"');
  });
});
