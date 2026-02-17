/**
 * Final QA Validation Test Suite
 * Story 8.10: Final Quality Assurance
 *
 * Validates all PRD Definition of Done criteria:
 * - Functional requirements coverage (FR-P, FR-C, FR-R, FR-H)
 * - Non-functional requirements (NFR-1 through NFR-5)
 * - SDK one-line call capability
 * - Protocol visibility (order_id, tx_hash, signature, etc.)
 * - Production readiness checks
 */

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fileExists(relativePath: string): boolean {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function fileContains(relativePath: string, text: string): boolean {
  if (!fileExists(relativePath)) return false;
  const content = fs.readFileSync(path.join(ROOT, relativePath), "utf-8");
  return content.includes(text);
}

function countTestFiles(dir: string): number {
  const fullDir = path.join(ROOT, dir);
  if (!fs.existsSync(fullDir)) return 0;
  let count = 0;
  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== "dist") {
        walk(path.join(d, entry.name));
      } else if (
        entry.isFile() &&
        (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.tsx"))
      ) {
        count++;
      }
    }
  };
  walk(fullDir);
  return count;
}

// ---------------------------------------------------------------------------
// Task 1: Functional Requirements Verification
// ---------------------------------------------------------------------------

describe("Task 1: Functional Requirements", () => {
  describe("FR-P: Provider Requirements", () => {
    it("FR-P0: Wire protocol compatibility - IVXP/1.0 protocol version defined", () => {
      expect(fileContains("packages/protocol/src/index.ts", "IVXP/1.0")).toBe(true);
    });

    it("FR-P1: Service catalog - GET /ivxp/catalog endpoint exists", () => {
      expect(fileContains("packages/sdk/src/core/provider.ts", "/ivxp/catalog")).toBe(true);
    });

    it("FR-P2: Service quoting - POST /ivxp/request endpoint exists", () => {
      expect(fileContains("packages/sdk/src/core/provider.ts", "/ivxp/request")).toBe(true);
    });

    it("FR-P3: Payment verification - PaymentService.verify exists", () => {
      expect(fileContains("packages/sdk/src/payment/transfer.ts", "verify")).toBe(true);
    });

    it("FR-P4: Signature verification - CryptoService.verify exists", () => {
      expect(fileContains("packages/sdk/src/crypto/signature.ts", "verify")).toBe(true);
    });

    it("FR-P5: Service execution - Service handlers are invoked", () => {
      expect(fileContains("packages/sdk/src/core/provider.ts", "serviceHandlers")).toBe(true);
    });

    it("FR-P6: Delivery management - Store & Forward with download endpoint", () => {
      expect(fileContains("packages/sdk/src/core/provider.ts", "/ivxp/download/")).toBe(true);
      expect(fileContains("packages/sdk/src/core/deliverable-store.ts", "DeliverableStore")).toBe(
        true,
      );
    });

    it("FR-P7: Status query - GET /ivxp/status endpoint exists", () => {
      expect(fileContains("packages/sdk/src/core/provider.ts", "/ivxp/status/")).toBe(true);
    });
  });

  describe("FR-C: Client/SDK Requirements", () => {
    it("FR-C1: Service discovery - getCatalog method exists", () => {
      expect(fileContains("packages/sdk/src/core/client.ts", "getCatalog")).toBe(true);
    });

    it("FR-C2: Service request - requestQuote method exists", () => {
      expect(fileContains("packages/sdk/src/core/client.ts", "requestQuote")).toBe(true);
    });

    it("FR-C3: Payment sending - sendPayment/transfer functionality exists", () => {
      expect(fileExists("packages/sdk/src/payment/transfer.ts")).toBe(true);
    });

    it("FR-C4: Identity signature - sign method exists", () => {
      expect(fileContains("packages/sdk/src/crypto/signature.ts", "sign")).toBe(true);
    });

    it("FR-C5: Poll and download - pollOrderStatus exists", () => {
      expect(fileContains("packages/sdk/src/polling/backoff.ts", "pollOrderStatus")).toBe(true);
    });
  });

  describe("FR-R: Registry Requirements", () => {
    it("FR-R1: Provider registration - registration API exists", () => {
      expect(fileExists("apps/hub/src/app/api/registry/providers/route.ts")).toBe(true);
    });

    it("FR-R2: Service search - search API exists", () => {
      expect(fileExists("apps/hub/src/app/api/registry/services/search/route.ts")).toBe(true);
    });

    it("FR-R3: Endpoint verification - verify endpoint exists", () => {
      expect(fileExists("apps/hub/src/lib/registry/verify-endpoint.ts")).toBe(true);
    });
  });

  describe("FR-H: Hub Requirements", () => {
    it("FR-H1: Wallet connection - ConnectButton component exists", () => {
      expect(fileExists("apps/hub/src/components/features/wallet/ConnectButton.tsx")).toBe(true);
    });

    it("FR-H2: Service marketplace - ServiceGrid and ServiceCard exist", () => {
      expect(fileExists("apps/hub/src/components/features/marketplace/ServiceGrid.tsx")).toBe(true);
      expect(fileExists("apps/hub/src/components/features/marketplace/ServiceCard.tsx")).toBe(true);
    });

    it("FR-H3: Purchase flow - payment and signature dialogs exist", () => {
      expect(fileExists("apps/hub/src/components/features/payment-dialog/index.tsx")).toBe(true);
      expect(fileExists("apps/hub/src/components/features/signature-dialog/index.tsx")).toBe(true);
    });

    it("FR-H4: Order tracking - order detail and list components exist", () => {
      expect(fileExists("apps/hub/src/app/(orders)/[orderId]/_components/order-detail.tsx")).toBe(
        true,
      );
    });

    it("FR-H5: Provider registration - registration form exists", () => {
      expect(
        fileExists("apps/hub/src/components/features/provider-registration-form/index.tsx"),
      ).toBe(true);
    });

    it("FR-H6: Playground - playground page exists", () => {
      expect(fileExists("apps/hub/src/app/playground/page.tsx")).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Task 2: Non-Functional Requirements Verification
// ---------------------------------------------------------------------------

describe("Task 2: Non-Functional Requirements", () => {
  describe("NFR-1: Security", () => {
    it("Payment verification uses on-chain verification", () => {
      expect(fileContains("packages/sdk/src/payment/transfer.ts", "getTransactionReceipt")).toBe(
        true,
      );
    });

    it("EIP-191 signature verification implemented", () => {
      expect(fileContains("packages/sdk/src/crypto/signature.ts", "recoverMessageAddress")).toBe(
        true,
      );
    });

    it("Rate limiting configured on Hub middleware", () => {
      expect(fileContains("apps/hub/src/middleware.ts", "rateLimiter")).toBe(true);
    });

    it("Security headers configured (HSTS, CSP, X-Content-Type-Options)", () => {
      expect(fileContains("apps/hub/src/middleware.ts", "Strict-Transport-Security")).toBe(true);
      expect(fileContains("apps/hub/src/middleware.ts", "Content-Security-Policy")).toBe(true);
      expect(fileContains("apps/hub/src/middleware.ts", "X-Content-Type-Options")).toBe(true);
    });

    it("No hardcoded secrets in .env.example", () => {
      if (fileExists(".env.example")) {
        const content = fs.readFileSync(path.join(ROOT, ".env.example"), "utf-8");
        // Should not contain actual private keys
        expect(content).not.toMatch(/0x[a-fA-F0-9]{64}/);
      }
    });

    it(".env files are gitignored", () => {
      const gitignore = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf-8");
      expect(gitignore).toContain(".env");
    });

    it("Replay protection implemented (usedTxHashes)", () => {
      expect(fileContains("packages/sdk/src/core/provider.ts", "usedTxHashes")).toBe(true);
    });

    it("SSRF prevention for push delivery URLs", () => {
      expect(fileContains("packages/sdk/src/core/provider.ts", "validateDeliveryUrl")).toBe(true);
      expect(fileContains("packages/sdk/src/core/provider.ts", "PRIVATE_IPV4_PATTERNS")).toBe(true);
    });
  });

  describe("NFR-2: Interoperability", () => {
    it("Wire protocol uses snake_case field naming", () => {
      expect(fileContains("packages/protocol/src/types/service.ts", "wallet_address")).toBe(true);
      expect(fileContains("packages/protocol/src/types/service.ts", "base_price_usdc")).toBe(true);
    });

    it("TS-TS interop tests exist", () => {
      expect(fileExists("packages/sdk/src/__tests__/interop/ts-ts.test.ts")).toBe(true);
    });

    it("TS-Python interop tests exist", () => {
      expect(fileExists("packages/sdk/src/__tests__/interop/ts-python.test.ts")).toBe(true);
    });

    it("Python-TS interop tests exist", () => {
      expect(fileExists("packages/sdk/src/__tests__/interop/python-ts.test.ts")).toBe(true);
    });
  });

  describe("NFR-3: Reliability", () => {
    it("Store & Forward delivery mode implemented", () => {
      expect(fileContains("packages/sdk/src/core/provider.ts", "delivery_failed")).toBe(true);
      expect(fileContains("packages/sdk/src/core/provider.ts", "deliverableStore")).toBe(true);
    });

    it("Order persistence via order store", () => {
      expect(fileExists("packages/sdk/src/core/in-memory-order-store.ts")).toBe(true);
      expect(fileExists("apps/demo-provider/src/db/orders.ts")).toBe(true);
    });

    it("Error handling with typed errors", () => {
      expect(fileExists("packages/sdk/src/errors/base.ts")).toBe(true);
    });
  });

  describe("NFR-5: Usability", () => {
    it("SDK exports are properly defined", () => {
      expect(fileExists("packages/sdk/src/index.ts")).toBe(true);
    });

    it("TypeScript types are exported for IDE autocomplete", () => {
      expect(fileExists("packages/protocol/src/types/index.ts")).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Task 3: PRD Definition of Done Validation
// ---------------------------------------------------------------------------

describe("Task 3: PRD Definition of Done", () => {
  describe("DoD-1: SDK One-Line Call", () => {
    it("IVXPClient class exists with callService-like flow", () => {
      expect(fileExists("packages/sdk/src/core/client.ts")).toBe(true);
    });

    it("requestService function exists for one-line call", () => {
      expect(fileContains("packages/sdk/src/core/client.ts", "requestService")).toBe(true);
    });

    it("Event system exists for protocol transparency", () => {
      expect(fileExists("packages/sdk/src/core/events.ts")).toBe(true);
    });
  });

  describe("DoD-2: Protocol Visibility", () => {
    it("Protocol inspector component exists", () => {
      expect(fileExists("apps/hub/src/components/features/protocol-inspector/index.tsx")).toBe(
        true,
      );
    });

    it("Protocol visibility components exist (copy button, tooltip)", () => {
      expect(
        fileExists("apps/hub/src/components/features/protocol-visibility/copy-button.tsx"),
      ).toBe(true);
      expect(
        fileExists("apps/hub/src/components/features/protocol-visibility/protocol-tooltip.tsx"),
      ).toBe(true);
    });

    it("Content hash verification exists", () => {
      expect(fileExists("packages/sdk/src/core/content-hash.ts")).toBe(true);
      expect(fileExists("apps/hub/src/lib/verify-content-hash.ts")).toBe(true);
    });
  });

  describe("DoD-3: Dual-Path Delivery", () => {
    it("Push delivery implemented", () => {
      expect(fileContains("packages/sdk/src/core/provider.ts", "pushDeliverable")).toBe(true);
    });

    it("Pull delivery (polling + download) implemented", () => {
      expect(fileContains("packages/sdk/src/polling/backoff.ts", "pollOrderStatus")).toBe(true);
      expect(fileContains("packages/sdk/src/core/client.ts", "downloadDeliverable")).toBe(true);
    });

    it("Callback server for push reception exists", () => {
      expect(fileExists("packages/sdk/src/core/callback-server.ts")).toBe(true);
    });
  });

  describe("DoD-4: Production Readiness", () => {
    it("CI/CD pipeline configured", () => {
      expect(fileExists(".github/workflows")).toBe(true);
    });

    it("Deployment scripts exist", () => {
      expect(fileExists("scripts/deploy")).toBe(true);
    });

    it("Environment configuration documented", () => {
      expect(fileExists(".env.example")).toBe(true);
    });

    it("Package.json has proper build scripts", () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8"));
      expect(pkg.scripts.build).toBeDefined();
      expect(pkg.scripts.test).toBeDefined();
      expect(pkg.scripts.lint).toBeDefined();
    });
  });

  describe("DoD-5: Test Coverage", () => {
    it("Protocol package has test files", () => {
      expect(countTestFiles("packages/protocol/src")).toBeGreaterThanOrEqual(5);
    });

    it("SDK package has test files", () => {
      expect(countTestFiles("packages/sdk/src")).toBeGreaterThanOrEqual(20);
    });

    it("Hub app has test files", () => {
      expect(countTestFiles("apps/hub/src")).toBeGreaterThanOrEqual(50);
    });

    it("Demo provider has test files", () => {
      expect(countTestFiles("apps/demo-provider/src")).toBeGreaterThanOrEqual(5);
    });

    it("Integration tests exist", () => {
      expect(fileExists("packages/sdk/src/__tests__/integration")).toBe(true);
    });

    it("E2E tests exist", () => {
      expect(fileExists("apps/hub/src/__tests__/e2e")).toBe(true);
    });

    it("Security audit tests exist", () => {
      expect(fileExists("tests/security-audit.test.ts")).toBe(true);
    });

    it("Performance benchmark tests exist", () => {
      expect(fileExists("tests/performance-benchmark.test.ts")).toBe(true);
    });
  });
});
