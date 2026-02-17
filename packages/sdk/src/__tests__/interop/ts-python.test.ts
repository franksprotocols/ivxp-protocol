/**
 * TS Client -> Python Provider Interoperability Tests
 *
 * Story 6.6: Verifies that the TypeScript SDK Client can successfully
 * communicate with a Python IVXP/1.0 Provider implementation.
 *
 * Test architecture:
 * - Spawns a minimal Python Flask Provider as a child process.
 * - Uses real IVXPClient making actual HTTP requests via fetch.
 * - Validates wire protocol compatibility (snake_case, timestamps, etc.).
 * - No external blockchain dependencies (mock crypto/payment).
 *
 * Acceptance criteria covered:
 * - AC #1: TS Client can call Python Provider successfully
 * - AC #3: All protocol messages are exchanged correctly
 * - AC #4: Wire protocol compatibility is verified
 */

import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClientFixture, type ClientFixture } from "./fixtures/client-fixture.js";
import {
  httpGet,
  httpPost,
  buildServiceRequestBody,
  buildDeliveryRequestBody,
  waitForCondition,
} from "./utils/test-helpers.js";
import {
  assertValidCatalog,
  assertValidQuote,
  assertValidDeliveryAccepted,
  assertValidStatusResponse,
  assertValidDownloadResponse,
  assertValidContentHash,
  hasSnakeCaseFields,
  hasDeepSnakeCaseFields,
} from "./utils/assertions.js";
import { computeContentHash } from "../../core/content-hash.js";
import testData from "./shared/test-data.json" with { type: "json" };

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SETUP_TIMEOUT_MS = 30_000;
const TEST_TIMEOUT_MS = 30_000;
/** Generous poll timeout for CI environments where Python may be slower. */
const POLL_TIMEOUT_MS = 30_000;

const PYTHON_DIR = path.resolve(import.meta.dirname, "python");
const PROVIDER_SCRIPT = path.join(PYTHON_DIR, "minimal_provider.py");
const PYTHON_BIN = path.join(PYTHON_DIR, ".venv", "bin", "python3");

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

interface CatalogResponse {
  readonly protocol: string;
  readonly message_type: string;
  readonly timestamp: string;
  readonly provider: string;
  readonly wallet_address: string;
  readonly services: ReadonlyArray<{
    readonly type: string;
    readonly base_price_usdc: number;
    readonly estimated_delivery_hours: number;
  }>;
}

interface QuoteResponse {
  readonly protocol: string;
  readonly message_type: string;
  readonly timestamp: string;
  readonly order_id: string;
  readonly provider_agent: {
    readonly name: string;
    readonly wallet_address: string;
  };
  readonly quote: {
    readonly price_usdc: number;
    readonly estimated_delivery: string;
    readonly payment_address: string;
    readonly network: string;
  };
}

interface DeliveryAcceptedResponse {
  readonly order_id: string;
  readonly status: "accepted";
  readonly message: string;
}

interface StatusResponse {
  readonly order_id: string;
  readonly status: string;
  readonly service: string;
  readonly created_at: string;
  readonly content_hash?: string;
}

interface DownloadResponse {
  readonly order_id: string;
  readonly content: string;
  readonly content_type: string;
  readonly content_hash: string;
}

interface ErrorResponse {
  readonly error: string;
  readonly status_code?: number;
}

// ---------------------------------------------------------------------------
// Python process management
// ---------------------------------------------------------------------------

/**
 * Validate that the Python virtual environment exists and has Flask installed.
 * Throws a descriptive error if the venv is missing or incomplete.
 */
async function assertPythonVenvReady(): Promise<void> {
  if (!fs.existsSync(PYTHON_BIN)) {
    throw new Error(
      `Python venv not found at ${PYTHON_BIN}.\n` +
        `Run the following to set it up:\n` +
        `  cd ${PYTHON_DIR}\n` +
        `  python3 -m venv .venv\n` +
        `  .venv/bin/pip install -r requirements.txt`,
    );
  }

  // Verify Flask is importable
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const exec = promisify(execFile);
  try {
    await exec(PYTHON_BIN, ["-c", "import flask"], { timeout: 10_000 });
  } catch {
    throw new Error(
      `Python venv at ${PYTHON_DIR}/.venv is missing Flask.\n` +
        `Run: ${PYTHON_BIN.replace("python3", "pip")} install -r ${PYTHON_DIR}/requirements.txt`,
    );
  }
}

/**
 * Find an available port by briefly listening on port 0.
 */
async function findAvailablePort(): Promise<number> {
  const { createServer } = await import("node:net");
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr && typeof addr === "object") {
        const port = addr.port;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error("Failed to get port")));
      }
    });
    server.on("error", reject);
  });
}

/**
 * Start the Python provider process and wait for it to be ready.
 *
 * Listens for the process exit event so that a crash during startup
 * rejects immediately instead of waiting for the full poll timeout.
 */
async function startPythonProvider(port: number): Promise<ChildProcess> {
  const proc = spawn(PYTHON_BIN, [PROVIDER_SCRIPT, String(port)], {
    cwd: PYTHON_DIR,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  });

  let stderr = "";
  proc.stderr?.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  // Track early exit so the poll loop can bail out immediately
  let exitCode: number | null = null;
  let exitSignal: string | null = null;
  proc.on("exit", (code, signal) => {
    exitCode = code;
    exitSignal = signal;
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForCondition(
    async () => {
      // If the process already exited, stop polling and fail fast
      if (exitCode !== null || exitSignal !== null) {
        throw new Error(
          `Python provider exited during startup ` +
            `(code=${exitCode}, signal=${exitSignal}). stderr:\n${stderr}`,
        );
      }
      try {
        const res = await fetch(`${baseUrl}/ivxp/catalog`);
        return res.ok;
      } catch {
        return false;
      }
    },
    {
      timeout: 15_000,
      interval: 200,
      message:
        `Python provider did not start on port ${port}.\n` +
        `exitCode=${exitCode}, signal=${exitSignal}\nstderr:\n${stderr}`,
    },
  );

  return proc;
}

/**
 * Gracefully stop a Python provider process.
 *
 * Sends SIGTERM first, waits briefly, then escalates to SIGKILL
 * if the process is still alive. Safe to call if the process has
 * already exited.
 */
async function stopPythonProvider(proc: ChildProcess | undefined): Promise<void> {
  if (!proc || proc.exitCode !== null || proc.killed) return;

  proc.kill("SIGTERM");
  await new Promise((r) => setTimeout(r, 500));

  // Escalate if still alive
  if (proc.exitCode === null && !proc.killed) {
    proc.kill("SIGKILL");
    await new Promise((r) => setTimeout(r, 200));
  }
}

// ---------------------------------------------------------------------------
// Helper: full order lifecycle
// ---------------------------------------------------------------------------

async function runFullOrderLifecycle(
  baseUrl: string,
  serviceType: string,
  description = "Lifecycle test",
): Promise<{ orderId: string; download: DownloadResponse }> {
  const quoteRes = await httpPost<QuoteResponse>(
    `${baseUrl}/ivxp/request`,
    buildServiceRequestBody(serviceType, description),
  );
  const orderId = quoteRes.body.order_id;

  await httpPost(`${baseUrl}/ivxp/deliver`, buildDeliveryRequestBody(orderId));

  // Poll with exponential backoff: 50ms -> 100ms -> 200ms -> ... capped at 1s
  let interval = 50;
  await waitForCondition(
    async () => {
      const res = await httpGet<StatusResponse>(`${baseUrl}/ivxp/status/${orderId}`);
      if (res.body.status === "delivered") return true;
      interval = Math.min(interval * 2, 1_000);
      return false;
    },
    { timeout: POLL_TIMEOUT_MS, interval, message: `Order ${orderId} did not reach 'delivered'` },
  );

  const download = await httpGet<DownloadResponse>(`${baseUrl}/ivxp/download/${orderId}`);
  return { orderId, download: download.body };
}

// ===========================================================================
// AC #1: TS Client can call Python Provider successfully
// ===========================================================================

describe("TS Client -> Python Provider (AC #1)", () => {
  let pythonProc: ChildProcess;
  let baseUrl: string;
  let client: ClientFixture;

  beforeAll(async () => {
    await assertPythonVenvReady();
    const port = await findAvailablePort();
    pythonProc = await startPythonProvider(port);
    baseUrl = `http://127.0.0.1:${port}`;
    client = createClientFixture();
  }, SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await stopPythonProvider(pythonProc);
  });

  it("should fetch catalog from Python provider via SDK client", async () => {
    const catalog = await client.client.getCatalog(baseUrl);

    expect(catalog.provider).toBe("PythonTestProvider");
    expect(catalog.services).toHaveLength(2);
    expect(catalog.services[0].type).toBe("text_echo");
    expect(catalog.services[0].basePriceUsdc).toBe(1);
    expect(catalog.services[1].type).toBe("json_transform");
    expect(catalog.services[1].basePriceUsdc).toBe(5);
  });

  it("should request a quote from Python provider via SDK client", async () => {
    const quote = await client.client.requestQuote(baseUrl, {
      serviceType: "text_echo",
      description: "Cross-language test",
      budgetUsdc: 10,
    });

    expect(quote.orderId).toBeDefined();
    expect(quote.orderId.startsWith("ivxp-")).toBe(true);
    expect(quote.quote.priceUsdc).toBe(1);
    expect(quote.quote.network).toBe("base-sepolia");
  });

  it("should fetch catalog via direct HTTP GET", async () => {
    const res = await httpGet<CatalogResponse>(`${baseUrl}/ivxp/catalog`);

    expect(res.status).toBe(200);
    expect(res.body.protocol).toBe("IVXP/1.0");
    expect(res.body.provider).toBe("PythonTestProvider");
    expect(res.body.wallet_address).toBe(testData.test_accounts.provider.address);
    expect(res.body.services).toHaveLength(2);
  });

  it(
    "should complete full flow: catalog -> quote -> deliver -> status -> download",
    async () => {
      // Step 1: Catalog
      const catalogRes = await httpGet<CatalogResponse>(`${baseUrl}/ivxp/catalog`);
      expect(catalogRes.status).toBe(200);

      // Step 2: Quote
      const quoteRes = await httpPost<QuoteResponse>(
        `${baseUrl}/ivxp/request`,
        buildServiceRequestBody("text_echo", "Full flow cross-lang"),
      );
      expect(quoteRes.status).toBe(200);
      const orderId = quoteRes.body.order_id;

      // Step 3: Deliver
      const deliverRes = await httpPost<DeliveryAcceptedResponse>(
        `${baseUrl}/ivxp/deliver`,
        buildDeliveryRequestBody(orderId),
      );
      expect(deliverRes.status).toBe(200);
      expect(deliverRes.body.status).toBe("accepted");

      // Step 4: Status (poll with exponential backoff)
      let pollInterval = 50;
      await waitForCondition(
        async () => {
          const res = await httpGet<StatusResponse>(`${baseUrl}/ivxp/status/${orderId}`);
          if (res.body.status === "delivered") return true;
          pollInterval = Math.min(pollInterval * 2, 1_000);
          return false;
        },
        { timeout: POLL_TIMEOUT_MS, interval: pollInterval },
      );

      const statusRes = await httpGet<StatusResponse>(`${baseUrl}/ivxp/status/${orderId}`);
      expect(statusRes.body.status).toBe("delivered");
      expect(statusRes.body.content_hash).toBeDefined();

      // Step 5: Download
      const downloadRes = await httpGet<DownloadResponse>(`${baseUrl}/ivxp/download/${orderId}`);
      expect(downloadRes.status).toBe(200);
      expect(downloadRes.body.order_id).toBe(orderId);
      expect(downloadRes.body.content).toBeDefined();
      expect(downloadRes.body.content_hash).toBe(statusRes.body.content_hash);
    },
    TEST_TIMEOUT_MS,
  );
});

// ===========================================================================
// AC #3: Protocol message validation (TS -> Python)
// ===========================================================================

describe("Protocol validation: TS -> Python (AC #3)", () => {
  let pythonProc: ChildProcess;
  let baseUrl: string;

  beforeAll(async () => {
    await assertPythonVenvReady();
    const port = await findAvailablePort();
    pythonProc = await startPythonProvider(port);
    baseUrl = `http://127.0.0.1:${port}`;
  }, SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await stopPythonProvider(pythonProc);
  });

  it("should return valid IVXP/1.0 catalog from Python provider", async () => {
    const res = await httpGet<Record<string, unknown>>(`${baseUrl}/ivxp/catalog`);
    expect(res.status).toBe(200);
    assertValidCatalog(res.body);
  });

  it("should return valid IVXP/1.0 quote from Python provider", async () => {
    const res = await httpPost<Record<string, unknown>>(
      `${baseUrl}/ivxp/request`,
      buildServiceRequestBody("text_echo"),
    );
    expect(res.status).toBe(200);
    assertValidQuote(res.body);
  });

  it("should return valid delivery accepted from Python provider", async () => {
    const quoteRes = await httpPost<QuoteResponse>(
      `${baseUrl}/ivxp/request`,
      buildServiceRequestBody("text_echo"),
    );
    const orderId = quoteRes.body.order_id;

    const deliverRes = await httpPost<Record<string, unknown>>(
      `${baseUrl}/ivxp/deliver`,
      buildDeliveryRequestBody(orderId),
    );
    expect(deliverRes.status).toBe(200);
    assertValidDeliveryAccepted(deliverRes.body);
  });

  it("should return valid status from Python provider", async () => {
    const quoteRes = await httpPost<QuoteResponse>(
      `${baseUrl}/ivxp/request`,
      buildServiceRequestBody("text_echo"),
    );
    const orderId = quoteRes.body.order_id;

    const statusRes = await httpGet<Record<string, unknown>>(`${baseUrl}/ivxp/status/${orderId}`);
    expect(statusRes.status).toBe(200);
    assertValidStatusResponse(statusRes.body, orderId);
  });

  it("should return valid download with content hash from Python provider", async () => {
    const { orderId } = await runFullOrderLifecycle(baseUrl, "text_echo");

    const downloadRes = await httpGet<Record<string, unknown>>(
      `${baseUrl}/ivxp/download/${orderId}`,
    );
    expect(downloadRes.status).toBe(200);
    assertValidDownloadResponse(downloadRes.body, orderId);
    assertValidContentHash(downloadRes.body.content_hash as string);
  });

  it("should use snake_case in all Python provider responses", async () => {
    // Catalog
    const catalogRes = await httpGet<Record<string, unknown>>(`${baseUrl}/ivxp/catalog`);
    expect(hasSnakeCaseFields(catalogRes.body)).toBe(true);
    expect(hasDeepSnakeCaseFields(catalogRes.body)).toBe(true);

    // Quote
    const quoteRes = await httpPost<Record<string, unknown>>(
      `${baseUrl}/ivxp/request`,
      buildServiceRequestBody("text_echo"),
    );
    expect(hasSnakeCaseFields(quoteRes.body)).toBe(true);
    expect(hasDeepSnakeCaseFields(quoteRes.body)).toBe(true);

    const orderId = (quoteRes.body as unknown as QuoteResponse).order_id;

    // Delivery accepted
    const deliverRes = await httpPost<Record<string, unknown>>(
      `${baseUrl}/ivxp/deliver`,
      buildDeliveryRequestBody(orderId),
    );
    expect(hasSnakeCaseFields(deliverRes.body)).toBe(true);

    // Status
    const statusRes = await httpGet<Record<string, unknown>>(`${baseUrl}/ivxp/status/${orderId}`);
    expect(hasSnakeCaseFields(statusRes.body)).toBe(true);
  });

  it("should include valid ISO 8601 timestamps from Python provider", async () => {
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

    const catalogRes = await httpGet<CatalogResponse>(`${baseUrl}/ivxp/catalog`);
    expect(catalogRes.body.timestamp).toMatch(isoRegex);

    const quoteRes = await httpPost<QuoteResponse>(
      `${baseUrl}/ivxp/request`,
      buildServiceRequestBody("text_echo"),
    );
    expect(quoteRes.body.timestamp).toMatch(isoRegex);
  });

  it("should include 0x-prefixed wallet addresses from Python provider", async () => {
    const catalogRes = await httpGet<CatalogResponse>(`${baseUrl}/ivxp/catalog`);
    expect(catalogRes.body.wallet_address.startsWith("0x")).toBe(true);
    expect(catalogRes.body.wallet_address).toHaveLength(42);

    const quoteRes = await httpPost<QuoteResponse>(
      `${baseUrl}/ivxp/request`,
      buildServiceRequestBody("text_echo"),
    );
    expect(quoteRes.body.provider_agent.wallet_address.startsWith("0x")).toBe(true);
    expect(quoteRes.body.quote.payment_address.startsWith("0x")).toBe(true);
  });

  it("should verify content hash integrity across languages", async () => {
    const { download } = await runFullOrderLifecycle(baseUrl, "text_echo", "Hash test");

    assertValidContentHash(download.content_hash);

    // Recompute hash in TS from Python-generated content
    const recomputedHash = await computeContentHash(download.content);
    expect(download.content_hash).toBe(recomputedHash);
  });

  it("should produce consistent content hashes for non-ASCII Unicode content", async () => {
    // Unicode description exercises UTF-8 encoding consistency across languages
    const { download } = await runFullOrderLifecycle(
      baseUrl,
      "text_echo",
      "Unicode test: \u00e9\u00e0\u00fc \u4f60\u597d \ud83d\ude80",
    );

    assertValidContentHash(download.content_hash);
    const recomputedHash = await computeContentHash(download.content);
    expect(download.content_hash).toBe(recomputedHash);
  });

  it("should produce consistent content hashes for empty description", async () => {
    const { download } = await runFullOrderLifecycle(baseUrl, "text_echo", "");

    assertValidContentHash(download.content_hash);
    const recomputedHash = await computeContentHash(download.content);
    expect(download.content_hash).toBe(recomputedHash);
  });

  it("should not contain any camelCase fields in wire protocol", async () => {
    const catalogRes = await httpGet<CatalogResponse>(`${baseUrl}/ivxp/catalog`);
    const catalogJson = JSON.stringify(catalogRes.body);

    for (const camelField of testData.camel_case_blacklist) {
      expect(catalogJson).not.toContain(`"${camelField}"`);
    }

    const quoteRes = await httpPost<QuoteResponse>(
      `${baseUrl}/ivxp/request`,
      buildServiceRequestBody("text_echo"),
    );
    const quoteJson = JSON.stringify(quoteRes.body);

    for (const camelField of testData.camel_case_blacklist) {
      expect(quoteJson).not.toContain(`"${camelField}"`);
    }
  });
});

// ===========================================================================
// Error handling: TS -> Python
// ===========================================================================

describe("Error handling: TS -> Python", () => {
  let pythonProc: ChildProcess;
  let baseUrl: string;

  beforeAll(async () => {
    await assertPythonVenvReady();
    const port = await findAvailablePort();
    pythonProc = await startPythonProvider(port);
    baseUrl = `http://127.0.0.1:${port}`;
  }, SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await stopPythonProvider(pythonProc);
  });

  it("should return 404 for unknown endpoints from Python provider", async () => {
    const res = await httpGet<ErrorResponse>(`${baseUrl}/ivxp/nonexistent`);
    expect(res.status).toBe(404);
    expect(res.body).toBeDefined();
    expect(typeof res.body.error).toBe("string");
    expect(res.body.error.length).toBeGreaterThan(0);
    // Error messages must not leak stack traces
    expect(JSON.stringify(res.body)).not.toContain("Traceback");
    expect(JSON.stringify(res.body)).not.toContain('File "');
  });

  it("should return 405 for wrong HTTP method on Python catalog", async () => {
    const res = await httpPost<ErrorResponse>(`${baseUrl}/ivxp/catalog`, {});
    expect(res.status).toBe(405);
    expect(res.body).toBeDefined();
    expect(typeof res.body.error).toBe("string");
    expect(res.body.error.length).toBeGreaterThan(0);
  });

  it("should return 404 for unknown order status from Python provider", async () => {
    const res = await httpGet<ErrorResponse>(`${baseUrl}/ivxp/status/ivxp-nonexistent-order`);
    expect(res.status).toBe(404);
    expect(res.body).toBeDefined();
    expect(typeof res.body.error).toBe("string");
    expect(res.body.error.length).toBeGreaterThan(0);
  });

  it("should return error for unknown service type from Python provider", async () => {
    const res = await httpPost<ErrorResponse>(
      `${baseUrl}/ivxp/request`,
      buildServiceRequestBody("nonexistent_service"),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body).toBeDefined();
    expect(typeof res.body.error).toBe("string");
    expect(res.body.error.length).toBeGreaterThan(0);
    // Must not leak internal details
    expect(JSON.stringify(res.body)).not.toContain("Traceback");
  });

  it("should return error for delivery with wrong network from Python provider", async () => {
    const quoteRes = await httpPost<QuoteResponse>(
      `${baseUrl}/ivxp/request`,
      buildServiceRequestBody("text_echo"),
    );
    const orderId = quoteRes.body.order_id;

    const res = await httpPost<ErrorResponse>(
      `${baseUrl}/ivxp/deliver`,
      buildDeliveryRequestBody(orderId, { network: "ethereum-mainnet" }),
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Network mismatch");
  });

  it("should return error for duplicate delivery from Python provider", async () => {
    const quoteRes = await httpPost<QuoteResponse>(
      `${baseUrl}/ivxp/request`,
      buildServiceRequestBody("text_echo"),
    );
    const orderId = quoteRes.body.order_id;

    // First delivery
    const first = await httpPost<DeliveryAcceptedResponse>(
      `${baseUrl}/ivxp/deliver`,
      buildDeliveryRequestBody(orderId),
    );
    expect(first.status).toBe(200);

    // Second delivery should fail
    const second = await httpPost<ErrorResponse>(
      `${baseUrl}/ivxp/deliver`,
      buildDeliveryRequestBody(orderId),
    );
    expect(second.status).toBe(400);
  });
});
