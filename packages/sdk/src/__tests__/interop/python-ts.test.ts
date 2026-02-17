/**
 * Python Client -> TS Provider Interoperability Tests
 *
 * Story 6.6: Verifies that a Python IVXP/1.0 Client can successfully
 * communicate with the TypeScript IVXPProvider implementation.
 *
 * Test architecture:
 * - Starts a real IVXPProvider HTTP server (TS) with mock services.
 * - Spawns the Python minimal_client.py as a child process.
 * - Python client runs all protocol tests and outputs JSON results.
 * - TS test validates the Python client's results.
 *
 * Acceptance criteria covered:
 * - AC #2: Python Client can call TS Provider successfully
 * - AC #3: All protocol messages are exchanged correctly
 * - AC #4: Wire protocol compatibility is verified
 */

import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startProviderFixture, type ProviderFixture } from "./fixtures/provider-fixture.js";
import {
  httpGet,
  httpPost,
  buildServiceRequestBody,
  buildDeliveryRequestBody,
  waitForCondition,
  FAST_POLL,
} from "./utils/test-helpers.js";
import { hasSnakeCaseFields, hasDeepSnakeCaseFields } from "./utils/assertions.js";
import testData from "./shared/test-data.json" with { type: "json" };

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SETUP_TIMEOUT_MS = 15_000;
const TEST_TIMEOUT_MS = 60_000;

const PYTHON_DIR = path.resolve(import.meta.dirname, "python");
const CLIENT_SCRIPT = path.join(PYTHON_DIR, "minimal_client.py");
const PYTHON_BIN = path.join(PYTHON_DIR, ".venv", "bin", "python3");

// ---------------------------------------------------------------------------
// Python venv validation
// ---------------------------------------------------------------------------

/**
 * Validate that the Python virtual environment exists and has required deps.
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

  try {
    await execFileAsync(PYTHON_BIN, ["-c", "import flask, requests"], { timeout: 10_000 });
  } catch {
    throw new Error(
      `Python venv at ${PYTHON_DIR}/.venv is missing dependencies.\n` +
        `Run: ${PYTHON_BIN.replace("python3", "pip")} install -r ${PYTHON_DIR}/requirements.txt`,
    );
  }
}

// ---------------------------------------------------------------------------
// Types for Python client results
// ---------------------------------------------------------------------------

interface PythonTestResult {
  readonly name: string;
  readonly passed: boolean;
  readonly details: string;
  readonly data?: unknown;
}

interface PythonTestResults {
  readonly base_url: string;
  readonly tests: readonly PythonTestResult[];
  readonly passed: number;
  readonly failed: number;
  readonly errors: readonly string[];
}

// ---------------------------------------------------------------------------
// Wire protocol response types
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

// ===========================================================================
// AC #2: Python Client can call TS Provider successfully
// ===========================================================================

describe("Python Client -> TS Provider (AC #2)", () => {
  let provider: ProviderFixture;
  let pythonResults: PythonTestResults;

  beforeAll(async () => {
    await assertPythonVenvReady();
    provider = await startProviderFixture();

    // Run Python client against TS provider
    const { stdout } = await execFileAsync(PYTHON_BIN, [CLIENT_SCRIPT, provider.baseUrl], {
      cwd: PYTHON_DIR,
      timeout: TEST_TIMEOUT_MS - 5_000,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
    });

    pythonResults = JSON.parse(stdout) as PythonTestResults;
  }, TEST_TIMEOUT_MS);

  afterAll(async () => {
    await provider?.stop();
  });

  it("should have Python client connect to TS provider successfully", () => {
    expect(pythonResults).toBeDefined();
    expect(pythonResults.base_url).toBe(provider.baseUrl);
  });

  it("should pass catalog fetch test from Python client", () => {
    const test = pythonResults.tests.find((t) => t.name === "catalog_fetch");
    expect(test).toBeDefined();
    expect(test!.passed).toBe(true);
  });

  it("should pass quote request test from Python client", () => {
    const test = pythonResults.tests.find((t) => t.name === "request_quote");
    expect(test).toBeDefined();
    expect(test!.passed).toBe(true);
  });

  it("should pass delivery submission test from Python client", () => {
    const test = pythonResults.tests.find((t) => t.name === "submit_delivery");
    expect(test).toBeDefined();
    expect(test!.passed).toBe(true);
  });

  it("should pass status polling test from Python client", () => {
    const test = pythonResults.tests.find((t) => t.name === "poll_status");
    expect(test).toBeDefined();
    expect(test!.passed).toBe(true);
  });

  it("should pass download test from Python client", () => {
    const test = pythonResults.tests.find((t) => t.name === "download_deliverable");
    expect(test).toBeDefined();
    expect(test!.passed).toBe(true);
  });

  it("should pass error handling tests from Python client", () => {
    const unknownOrder = pythonResults.tests.find((t) => t.name === "error_unknown_order");
    expect(unknownOrder).toBeDefined();
    expect(unknownOrder!.passed).toBe(true);

    const wrongMethod = pythonResults.tests.find((t) => t.name === "error_wrong_method");
    expect(wrongMethod).toBeDefined();
    expect(wrongMethod!.passed).toBe(true);
  });

  it("should pass no-camelCase validation from Python client", () => {
    const test = pythonResults.tests.find((t) => t.name === "no_camel_case");
    expect(test).toBeDefined();
    expect(test!.passed).toBe(true);
  });

  it("should pass timestamp format validation from Python client", () => {
    const test = pythonResults.tests.find((t) => t.name === "timestamp_format");
    expect(test).toBeDefined();
    expect(test!.passed).toBe(true);
  });

  it("should pass address format validation from Python client", () => {
    const test = pythonResults.tests.find((t) => t.name === "address_format");
    expect(test).toBeDefined();
    expect(test!.passed).toBe(true);
  });

  it("should have all Python tests passing with zero failures", () => {
    expect(pythonResults.failed).toBe(0);
    expect(pythonResults.errors).toHaveLength(0);
    // Exact count guards against silently dropped tests
    const EXPECTED_PYTHON_TEST_COUNT = 10;
    expect(pythonResults.tests).toHaveLength(EXPECTED_PYTHON_TEST_COUNT);
    expect(pythonResults.passed).toBe(EXPECTED_PYTHON_TEST_COUNT);
  });
});

// ===========================================================================
// AC #3: Wire protocol compatibility (TS Provider -> Python Client)
// ===========================================================================

describe("Wire protocol compatibility: TS Provider responses (AC #3)", () => {
  let provider: ProviderFixture;
  let baseUrl: string;

  beforeAll(async () => {
    provider = await startProviderFixture();
    baseUrl = provider.baseUrl;
  }, SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await provider.stop();
  });

  it("should serve snake_case catalog that Python can parse", async () => {
    const res = await httpGet<Record<string, unknown>>(`${baseUrl}/ivxp/catalog`);
    expect(res.status).toBe(200);
    expect(hasSnakeCaseFields(res.body)).toBe(true);
    expect(hasDeepSnakeCaseFields(res.body)).toBe(true);

    // Verify no camelCase fields in raw JSON
    const rawJson = JSON.stringify(res.body);
    for (const camelField of testData.camel_case_blacklist) {
      expect(rawJson).not.toContain(`"${camelField}"`);
    }
  });

  it("should serve snake_case quotes that Python can parse", async () => {
    const res = await httpPost<Record<string, unknown>>(
      `${baseUrl}/ivxp/request`,
      buildServiceRequestBody("text_echo"),
    );
    expect(res.status).toBe(200);
    expect(hasSnakeCaseFields(res.body)).toBe(true);
    expect(hasDeepSnakeCaseFields(res.body)).toBe(true);
  });

  it("should use ISO 8601 timestamps compatible with Python datetime", async () => {
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

    const catalogRes = await httpGet<CatalogResponse>(`${baseUrl}/ivxp/catalog`);
    expect(catalogRes.body.timestamp).toMatch(isoRegex);

    const quoteRes = await httpPost<QuoteResponse>(
      `${baseUrl}/ivxp/request`,
      buildServiceRequestBody("text_echo"),
    );
    expect(quoteRes.body.timestamp).toMatch(isoRegex);
  });

  it("should use 0x-prefixed hex addresses compatible with Python eth-account", async () => {
    const catalogRes = await httpGet<CatalogResponse>(`${baseUrl}/ivxp/catalog`);
    expect(catalogRes.body.wallet_address).toMatch(/^0x[0-9a-fA-F]{40}$/);

    const quoteRes = await httpPost<QuoteResponse>(
      `${baseUrl}/ivxp/request`,
      buildServiceRequestBody("text_echo"),
    );
    expect(quoteRes.body.provider_agent.wallet_address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(quoteRes.body.quote.payment_address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it("should produce SHA-256 content hashes compatible with Python hashlib", async () => {
    const quoteRes = await httpPost<QuoteResponse>(
      `${baseUrl}/ivxp/request`,
      buildServiceRequestBody("text_echo", "Hash compat test"),
    );
    const orderId = quoteRes.body.order_id;

    await httpPost(`${baseUrl}/ivxp/deliver`, buildDeliveryRequestBody(orderId));

    await waitForCondition(
      async () => {
        const res = await httpGet<{ status: string }>(`${baseUrl}/ivxp/status/${orderId}`);
        return res.body.status === "delivered";
      },
      { timeout: FAST_POLL.timeout },
    );

    const downloadRes = await httpGet<{
      content: string;
      content_hash: string;
    }>(`${baseUrl}/ivxp/download/${orderId}`);

    // Verify hash format: 64 hex chars (SHA-256, no 0x prefix)
    expect(downloadRes.body.content_hash).toMatch(/^[0-9a-fA-F]{64}$/);
  });

  it("should generate unique order IDs with ivxp- prefix", async () => {
    const ids = new Set<string>();
    for (let i = 0; i < 3; i++) {
      const res = await httpPost<QuoteResponse>(
        `${baseUrl}/ivxp/request`,
        buildServiceRequestBody("text_echo"),
      );
      expect(res.body.order_id.startsWith("ivxp-")).toBe(true);
      ids.add(res.body.order_id);
    }
    expect(ids.size).toBe(3);
  });
});
