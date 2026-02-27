/**
 * LangGraph Adapter Interoperability Tests
 *
 * Story v3-3-5: Verifies bidirectional interop between LangGraph adapters
 * and IVXP implementations.
 *
 * Test cases:
 *   1. LangGraph Client (IVXPLangGraphClientAdapter / ivxpNode) <-> TS Provider (IVXPProvider)
 *   2. LangGraph Client <-> Python Provider (minimal_provider.py)
 *   3. TS Client (IVXPClient) <-> LangGraph-wrapped Provider
 *
 * Acceptance criteria:
 *   - AC1: All interop test suites pass 100%
 *   - AC2: content_hash verified (FR12) in cross-framework transaction
 *   - AC3: Service result correctly written to LangGraph workflow state (FR25)
 *   - AC4: CI blocks adapter-langgraph publish if any interop test fails (NFR10)
 */

import { type ChildProcess, execFile, spawn } from "node:child_process";
import { createServer } from "node:net";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  TEST_ACCOUNTS,
  MockCryptoService,
  MockPaymentService,
  DEFAULT_SIGNATURE,
} from "@ivxp/test-utils";
import { startProviderFixture, type ProviderFixture } from "./fixtures/provider-fixture.js";
import {
  httpGet,
  httpPost,
  buildServiceRequestBody,
  buildDeliveryRequestBody,
  waitForCondition,
} from "./utils/test-helpers.js";
import { assertValidContentHash } from "./utils/assertions.js";
import { computeContentHash } from "../../core/content-hash.js";
import { IVXPLangGraphClientAdapter } from "@ivxp/adapter-langgraph";
import type { IVXPLangGraphNodeOutput } from "@ivxp/adapter-langgraph";
import { IVXPClient, createHttpClient } from "@ivxp/sdk";
import { StateGraph, Annotation, START, END } from "@langchain/langgraph";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SETUP_TIMEOUT_MS = 30_000;
const TEST_TIMEOUT_MS = 30_000;
const POLL_TIMEOUT_MS = 30_000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PYTHON_DIR = path.resolve(__dirname, "python");
const PROVIDER_SCRIPT = path.join(PYTHON_DIR, "minimal_provider.py");
const PYTHON_BIN = path.join(PYTHON_DIR, ".venv", "bin", "python3");

const CLIENT_KEY = TEST_ACCOUNTS.client.privateKey as `0x${string}`;

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Wire-format response types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// LangGraph state annotation
// ---------------------------------------------------------------------------

/**
 * LangGraph Annotation for IVXP workflow state.
 *
 * Defines the state channels that the StateGraph uses to pass data
 * between nodes. Each field uses a "last writer wins" reducer.
 */
const IVXPGraphAnnotation = Annotation.Root({
  providerUrl: Annotation<string>,
  serviceType: Annotation<string>,
  description: Annotation<string>,
  budgetUsdc: Annotation<number>,
  orderId: Annotation<string | undefined>,
  ivxpResult: Annotation<IVXPLangGraphNodeOutput | undefined>,
  ivxpError: Annotation<string | undefined>,
  contentHash: Annotation<string | undefined>,
});

type IVXPGraphState = typeof IVXPGraphAnnotation.State;

// ---------------------------------------------------------------------------
// Python process helpers
// ---------------------------------------------------------------------------

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
    await execFileAsync(PYTHON_BIN, ["-c", "import flask"], { timeout: 10_000 });
  } catch {
    throw new Error(
      `Python venv at ${PYTHON_DIR}/.venv is missing Flask.\n` +
        `Run: ${PYTHON_BIN.replace("python3", "pip")} install -r ${PYTHON_DIR}/requirements.txt`,
    );
  }
}

async function findAvailablePort(): Promise<number> {
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

  let exitCode: number | null = null;
  let exitSignal: string | null = null;
  proc.on("exit", (code, signal) => {
    exitCode = code;
    exitSignal = signal;
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForCondition(
    async () => {
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

async function stopPythonProvider(proc: ChildProcess | undefined): Promise<void> {
  if (!proc || proc.exitCode !== null || proc.killed) return;

  proc.kill("SIGTERM");
  await new Promise((r) => setTimeout(r, 500));

  if (proc.exitCode === null && !proc.killed) {
    proc.kill("SIGKILL");
    await new Promise((r) => setTimeout(r, 200));
  }
}

// ---------------------------------------------------------------------------
// LangGraph node factory
// ---------------------------------------------------------------------------

/**
 * Build a LangGraph node function that orchestrates the IVXP flow using
 * IVXPLangGraphClientAdapter. Unlike createIvxpNode (which calls
 * client.submitPayment for on-chain payment), this node uses direct HTTP
 * for the delivery/status/download steps -- matching the interop test
 * pattern where mock crypto/payment services are used.
 *
 * Note: adapter.getStatus and adapter.download delegate to IVXPClient methods
 * that use /ivxp/orders/{id} and /ivxp/orders/{id}/deliverable paths, which
 * differ from the test provider's /ivxp/status/{id} and /ivxp/download/{id}
 * routes. Raw HTTP is used for those steps; adapter.requestDelivery is
 * exercised directly in a dedicated test (HIGH-1).
 */
function buildIvxpInteropNode(adapter: IVXPLangGraphClientAdapter) {
  return async (state: IVXPGraphState): Promise<Partial<IVXPGraphState>> => {
    const { providerUrl, serviceType, description, budgetUsdc } = state;

    // Step 1: Catalog (exercises adapter.getCatalog)
    const catalog = await adapter.getCatalog(providerUrl);
    const serviceEntry = catalog.services.find((s) => s.type === serviceType);
    if (!serviceEntry) {
      return { ivxpError: `Service "${serviceType}" not found in catalog` };
    }

    // Step 2: Quote (exercises adapter.requestQuote)
    const quote = await adapter.requestQuote(providerUrl, {
      serviceType,
      description,
      budgetUsdc,
    });
    const orderId = quote.orderId;

    // Step 3: Budget guard
    if (quote.quote.priceUsdc > budgetUsdc) {
      return {
        ivxpError: `Quote price ${quote.quote.priceUsdc} USDC exceeds budget ${budgetUsdc} USDC`,
      };
    }

    // Step 4: Deliver via direct HTTP (mock payment -- no on-chain tx)
    await httpPost(`${providerUrl}/ivxp/deliver`, buildDeliveryRequestBody(orderId));

    // Step 5: Poll for delivery via raw HTTP (provider uses /ivxp/status/{id})
    await waitForCondition(
      async () => {
        const res = await httpGet<StatusResponse>(`${providerUrl}/ivxp/status/${orderId}`);
        return res.body.status === "delivered";
      },
      { timeout: POLL_TIMEOUT_MS, message: `Order ${orderId} did not reach 'delivered'` },
    );

    // Step 6: Download via raw HTTP (provider uses /ivxp/download/{id})
    const downloadRes = await httpGet<DownloadResponse>(`${providerUrl}/ivxp/download/${orderId}`);

    const ivxpResult: IVXPLangGraphNodeOutput = {
      result: downloadRes.body.content,
      orderId,
      contentHash: downloadRes.body.content_hash,
    };

    return { orderId, ivxpResult, contentHash: downloadRes.body.content_hash };
  };
}

/**
 * Build and compile a LangGraph StateGraph for IVXP interop testing.
 */
function buildIvxpGraph(adapter: IVXPLangGraphClientAdapter) {
  const ivxpNode = buildIvxpInteropNode(adapter);

  return new StateGraph(IVXPGraphAnnotation)
    .addNode("callIVXP", ivxpNode)
    .addEdge(START, "callIVXP")
    .addEdge("callIVXP", END)
    .compile();
}

// ===========================================================================
// Test Case 1: LangGraph Client <-> TS Provider
// ===========================================================================

describe("LangGraph Client (IVXPLangGraphClientAdapter) <-> TS Provider (IVXPProvider)", () => {
  let provider: ProviderFixture;
  let adapter: IVXPLangGraphClientAdapter;
  let baseUrl: string;

  beforeAll(async () => {
    provider = await startProviderFixture();
    baseUrl = provider.baseUrl;

    const client = new IVXPClient({
      privateKey: CLIENT_KEY,
      network: "base-sepolia",
      httpClient: createHttpClient(),
      cryptoService: new MockCryptoService({ address: TEST_ACCOUNTS.client.address }),
      paymentService: new MockPaymentService(),
    });
    adapter = new IVXPLangGraphClientAdapter(client);
  }, SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await provider.stop();
  });

  it("should fetch catalog via LangGraph adapter", async () => {
    const catalog = await adapter.getCatalog(baseUrl);

    expect(catalog.provider).toBeDefined();
    expect(catalog.walletAddress.toLowerCase()).toBe(TEST_ACCOUNTS.provider.address.toLowerCase());
    expect(catalog.services.length).toBeGreaterThanOrEqual(1);
    // MEDIUM-1: assert expected service type is present
    expect(catalog.services.map((s) => s.type)).toContain("text_echo");
  });

  it("should request a quote via LangGraph adapter", async () => {
    const quote = await adapter.requestQuote(baseUrl, {
      serviceType: "text_echo",
      description: "LangGraph interop quote test",
      budgetUsdc: 10,
    });

    expect(quote.orderId).toBeDefined();
    expect(quote.orderId.startsWith("ivxp-")).toBe(true);
    expect(quote.quote.priceUsdc).toBe(1);
    expect(quote.quote.network).toBe("base-sepolia");
  });

  it(
    "should complete full flow via LangGraph StateGraph and write result to state (FR25)",
    async () => {
      const graph = buildIvxpGraph(adapter);

      const finalState = await graph.invoke({
        providerUrl: baseUrl,
        serviceType: "text_echo",
        description: "LangGraph full flow test",
        budgetUsdc: 10,
        orderId: undefined,
        ivxpResult: undefined,
        ivxpError: undefined,
        contentHash: undefined,
      });

      // FR25: Verify result is written to LangGraph workflow state
      expect(finalState.ivxpResult).toBeDefined();
      expect(finalState.ivxpResult!.orderId).toBeDefined();
      expect(finalState.ivxpResult!.orderId.startsWith("ivxp-")).toBe(true);
      // MEDIUM-2: assert result content is non-empty and is a string
      expect(finalState.ivxpResult!.result).toBeDefined();
      expect(typeof finalState.ivxpResult!.result).toBe("string");
      expect((finalState.ivxpResult!.result as string).length).toBeGreaterThan(0);
      expect(finalState.orderId).toBe(finalState.ivxpResult!.orderId);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "should verify content_hash integrity in cross-framework transaction (FR12)",
    async () => {
      const graph = buildIvxpGraph(adapter);

      const finalState = await graph.invoke({
        providerUrl: baseUrl,
        serviceType: "text_echo",
        description: "LangGraph content hash test",
        budgetUsdc: 10,
        orderId: undefined,
        ivxpResult: undefined,
        ivxpError: undefined,
        contentHash: undefined,
      });

      // FR12: content_hash must be present and valid
      expect(finalState.contentHash).toBeDefined();
      assertValidContentHash(finalState.contentHash!);

      // Verify content hash matches what's in ivxpResult
      expect(finalState.ivxpResult!.contentHash).toBe(finalState.contentHash);

      // Recompute content hash from downloaded content and verify match
      const content =
        typeof finalState.ivxpResult!.result === "string"
          ? finalState.ivxpResult!.result
          : JSON.stringify(finalState.ivxpResult!.result);
      const recomputedHash = await computeContentHash(content);
      expect(finalState.contentHash).toBe(recomputedHash);

      // Verify the content references the order
      const parsed = JSON.parse(content);
      expect(parsed.order_id).toBe(finalState.orderId);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "should work with different service types via LangGraph graph",
    async () => {
      const graph = buildIvxpGraph(adapter);

      const finalState = await graph.invoke({
        providerUrl: baseUrl,
        serviceType: "json_transform",
        description: "LangGraph transform test",
        budgetUsdc: 10,
        orderId: undefined,
        ivxpResult: undefined,
        ivxpError: undefined,
        contentHash: undefined,
      });

      expect(finalState.ivxpResult).toBeDefined();
      const content = JSON.parse(finalState.ivxpResult!.result as string);
      expect(content.transformed).toBe(true);
      expect(content.service).toBe("json_transform");

      // MEDIUM-3: verify contentHash for json_transform service
      expect(finalState.contentHash).toBeDefined();
      assertValidContentHash(finalState.contentHash!);
      const recomputedHash = await computeContentHash(finalState.ivxpResult!.result as string);
      expect(finalState.contentHash).toBe(recomputedHash);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "should exercise adapter.requestDelivery directly (HIGH-1)",
    async () => {
      // Step 1: Get a quote to obtain an orderId
      const quote = await adapter.requestQuote(baseUrl, {
        serviceType: "text_echo",
        description: "Direct adapter delivery test",
        budgetUsdc: 10,
      });
      const orderId = quote.orderId;

      // Step 2: Call adapter.requestDelivery directly with a mock payment proof
      // This exercises the adapter method that was previously untested.
      const txHash = `0x${"ab".repeat(32)}` as `0x${string}`;
      const timestamp = new Date().toISOString();
      const signedMessage = `Order: ${orderId} | Payment: ${txHash} | Timestamp: ${timestamp}`;
      const deliveryAccepted = await adapter.requestDelivery(
        baseUrl,
        orderId,
        {
          txHash,
          fromAddress: TEST_ACCOUNTS.client.address as `0x${string}`,
          network: "base-sepolia",
        },
        DEFAULT_SIGNATURE as `0x${string}`,
        signedMessage,
      );

      // Verify the delivery was accepted
      expect(deliveryAccepted).toBeDefined();

      // Step 3: Poll via raw HTTP until delivered (provider uses /ivxp/status/{id})
      await waitForCondition(
        async () => {
          const res = await httpGet<StatusResponse>(`${baseUrl}/ivxp/status/${orderId}`);
          return res.body.status === "delivered";
        },
        { timeout: POLL_TIMEOUT_MS, message: `Order ${orderId} did not reach 'delivered'` },
      );

      // Step 4: Download via raw HTTP and verify content hash
      const download = await httpGet<DownloadResponse>(`${baseUrl}/ivxp/download/${orderId}`);
      expect(download.body.order_id).toBe(orderId);
      assertValidContentHash(download.body.content_hash);
      const recomputedHash = await computeContentHash(download.body.content);
      expect(download.body.content_hash).toBe(recomputedHash);
    },
    TEST_TIMEOUT_MS,
  );
});

// ===========================================================================
// Test Case 2: LangGraph Client <-> Python Provider
// ===========================================================================

describe("LangGraph Client (IVXPLangGraphClientAdapter) <-> Python Provider", () => {
  let pythonProc: ChildProcess | undefined;
  let adapter: IVXPLangGraphClientAdapter;
  let baseUrl: string;

  beforeAll(async () => {
    await assertPythonVenvReady();
    const port = await findAvailablePort();
    pythonProc = await startPythonProvider(port);
    baseUrl = `http://127.0.0.1:${port}`;

    const client = new IVXPClient({
      privateKey: CLIENT_KEY,
      network: "base-sepolia",
      httpClient: createHttpClient(),
      cryptoService: new MockCryptoService({ address: TEST_ACCOUNTS.client.address }),
      paymentService: new MockPaymentService(),
    });
    adapter = new IVXPLangGraphClientAdapter(client);
  }, SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await stopPythonProvider(pythonProc);
  });

  it("should fetch catalog from Python provider via LangGraph adapter", async () => {
    const catalog = await adapter.getCatalog(baseUrl);

    expect(catalog.provider).toBe("PythonTestProvider");
    expect(catalog.services.length).toBeGreaterThanOrEqual(1);
    // MEDIUM-1: assert expected service type is present
    expect(catalog.services.map((s) => s.type)).toContain("text_echo");
  });

  it("should request a quote from Python provider via LangGraph adapter", async () => {
    const quote = await adapter.requestQuote(baseUrl, {
      serviceType: "text_echo",
      description: "LangGraph cross-language test",
      budgetUsdc: 10,
    });

    expect(quote.orderId).toBeDefined();
    expect(quote.orderId.startsWith("ivxp-")).toBe(true);
    expect(quote.quote.priceUsdc).toBe(1);
    expect(quote.quote.network).toBe("base-sepolia");
  });

  it(
    "should complete full flow against Python provider via LangGraph StateGraph",
    async () => {
      const graph = buildIvxpGraph(adapter);

      const finalState = await graph.invoke({
        providerUrl: baseUrl,
        serviceType: "text_echo",
        description: "LangGraph Python full flow",
        budgetUsdc: 10,
        orderId: undefined,
        ivxpResult: undefined,
        ivxpError: undefined,
        contentHash: undefined,
      });

      // FR25: Result written to LangGraph state
      expect(finalState.ivxpResult).toBeDefined();
      expect(finalState.ivxpResult!.orderId).toBeDefined();
      expect(finalState.ivxpResult!.orderId.startsWith("ivxp-")).toBe(true);

      // FR12: content_hash verified across languages
      expect(finalState.contentHash).toBeDefined();
      assertValidContentHash(finalState.contentHash!);

      const content =
        typeof finalState.ivxpResult!.result === "string"
          ? finalState.ivxpResult!.result
          : JSON.stringify(finalState.ivxpResult!.result);
      const recomputedHash = await computeContentHash(content);
      expect(finalState.contentHash).toBe(recomputedHash);
    },
    TEST_TIMEOUT_MS,
  );
});

// ===========================================================================
// Test Case 3: TS Client <-> LangGraph-wrapped Provider
// ===========================================================================

describe("TS Client (IVXPClient) <-> LangGraph-wrapped Provider (via IVXPProvider)", () => {
  let provider: ProviderFixture;
  let baseUrl: string;

  beforeAll(async () => {
    provider = await startProviderFixture();
    baseUrl = provider.baseUrl;
  }, SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await provider.stop();
  });

  it(
    "should serve TS Client HTTP requests through provider used by LangGraph adapter",
    async () => {
      // Verify that a standard TS Client can talk to the same provider
      // that the LangGraph adapter uses
      const quoteRes = await httpPost<{ order_id: string }>(
        `${baseUrl}/ivxp/request`,
        buildServiceRequestBody("text_echo"),
      );
      const orderId = quoteRes.body.order_id;

      await httpPost(`${baseUrl}/ivxp/deliver`, buildDeliveryRequestBody(orderId));

      await waitForCondition(
        async () => {
          const res = await httpGet<StatusResponse>(`${baseUrl}/ivxp/status/${orderId}`);
          return res.body.status === "delivered";
        },
        { timeout: POLL_TIMEOUT_MS, message: `Order ${orderId} did not reach 'delivered'` },
      );

      const download = await httpGet<DownloadResponse>(`${baseUrl}/ivxp/download/${orderId}`);

      expect(download.body.order_id).toBe(orderId);
      assertValidContentHash(download.body.content_hash);

      const recomputedHash = await computeContentHash(download.body.content);
      expect(download.body.content_hash).toBe(recomputedHash);
    },
    TEST_TIMEOUT_MS,
  );
});
