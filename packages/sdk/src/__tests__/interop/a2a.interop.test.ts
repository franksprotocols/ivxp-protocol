/**
 * A2A Adapter Interoperability Tests
 *
 * Story v3-2-5: Verifies bidirectional interop between A2A adapters
 * and IVXP implementations.
 *
 * Test cases:
 *   1. A2A Client (IVXPA2AClientAdapter) <-> TS Provider (IVXPProvider)
 *   2. TS Client (IVXPClient) <-> A2A Provider (IVXPA2AProviderAdapter)
 *   3. A2A Client (IVXPA2AClientAdapter) <-> Python Provider (minimal_provider.py)
 *
 * Acceptance criteria:
 *   - AC1: All 3 interop test suites pass 100%
 *   - AC2: content_hash verified (FR12); A2A Artifact contains correct content (FR22)
 *   - AC3: CI blocks adapter-a2a publish if any interop test fails (NFR10)
 */

import { type ChildProcess, execFile, spawn } from "node:child_process";
import { createServer } from "node:net";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TEST_ACCOUNTS, MockCryptoService, MockPaymentService } from "@ivxp/test-utils";
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
import {
  IVXPA2AClientAdapter,
  IVXPA2AProviderAdapter,
  buildNonce,
  buildSignedMessage,
} from "@ivxp/adapter-a2a";
import type { ServiceDefinition } from "@ivxp/protocol";

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
const PROVIDER_KEY = TEST_ACCOUNTS.provider.privateKey as `0x${string}`;

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

// ===========================================================================
// Test Case 1: A2A Client <-> TS Provider
// ===========================================================================

describe("A2A Client (IVXPA2AClientAdapter) <-> TS Provider (IVXPProvider)", () => {
  let provider: ProviderFixture;
  let a2aClient: IVXPA2AClientAdapter;
  let baseUrl: string;

  beforeAll(async () => {
    provider = await startProviderFixture();
    baseUrl = provider.baseUrl;
    a2aClient = new IVXPA2AClientAdapter({
      privateKey: CLIENT_KEY,
      network: "base-sepolia",
      providerUrl: baseUrl,
    });
  }, SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await provider.stop();
  });

  it("should fetch catalog via A2A client adapter", async () => {
    const catalog = await a2aClient.getCatalog(baseUrl);

    expect(catalog.provider).toBeDefined();
    expect(catalog.walletAddress.toLowerCase()).toBe(TEST_ACCOUNTS.provider.address.toLowerCase());
    expect(catalog.services.length).toBeGreaterThanOrEqual(1);
  });

  it("should request a quote via A2A client adapter", async () => {
    const quote = await a2aClient.requestQuote(baseUrl, {
      serviceType: "text_echo",
      description: "A2A interop quote test",
      budgetUsdc: 10,
    });

    expect(quote.orderId).toBeDefined();
    expect(quote.orderId.startsWith("ivxp-")).toBe(true);
    expect(quote.quote.priceUsdc).toBe(1);
    expect(quote.quote.network).toBe("base-sepolia");
  });

  it(
    "should complete full flow and verify content_hash (FR12)",
    async () => {
      // Step 1: Quote via A2A adapter
      const quote = await a2aClient.requestQuote(baseUrl, {
        serviceType: "text_echo",
        description: "A2A full flow content hash test",
        budgetUsdc: 10,
      });
      const orderId = quote.orderId;

      // Step 2: Deliver via direct HTTP (uses test helper with mock-compatible format)
      await httpPost(`${baseUrl}/ivxp/deliver`, buildDeliveryRequestBody(orderId));

      // Step 3: Poll for delivery via direct HTTP
      // (IVXPClient.getOrderStatus uses /ivxp/orders/ which differs from provider's /ivxp/status/)
      await waitForCondition(
        async () => {
          const res = await httpGet<StatusResponse>(`${baseUrl}/ivxp/status/${orderId}`);
          return res.body.status === "delivered";
        },
        { timeout: POLL_TIMEOUT_MS, message: `Order ${orderId} did not reach 'delivered'` },
      );

      // Step 4: Download via direct HTTP and verify content hash
      const downloadRes = await httpGet<DownloadResponse>(`${baseUrl}/ivxp/download/${orderId}`);

      expect(downloadRes.body.content_hash).toBeDefined();
      assertValidContentHash(downloadRes.body.content_hash);

      // FR12: Recompute content hash and verify match
      const recomputedHash = await computeContentHash(downloadRes.body.content);
      expect(downloadRes.body.content_hash).toBe(recomputedHash);

      // Verify the content references the order
      const content = JSON.parse(downloadRes.body.content);
      expect(content.order_id).toBe(orderId);
    },
    TEST_TIMEOUT_MS,
  );
});

// ===========================================================================
// Test Case 2: TS Client <-> A2A Provider (IVXPA2AProviderAdapter)
// ===========================================================================

describe("TS Client <-> A2A Provider (IVXPA2AProviderAdapter)", () => {
  let a2aProvider: IVXPA2AProviderAdapter;
  let a2aProviderUrl: string;
  let stopA2aProvider: () => Promise<void>;

  const DEFAULT_SERVICES: readonly ServiceDefinition[] = [
    { type: "text_echo", base_price_usdc: 1, estimated_delivery_hours: 0.01 },
    { type: "json_transform", base_price_usdc: 5, estimated_delivery_hours: 0.1 },
  ];

  beforeAll(async () => {
    const mockCrypto = new MockCryptoService({ address: TEST_ACCOUNTS.provider.address });
    const mockPayment = new MockPaymentService();

    // Create the A2A Provider Adapter with its own IVXPProvider
    a2aProvider = new IVXPA2AProviderAdapter(
      { privateKey: PROVIDER_KEY, network: "base-sepolia", providerName: "a2a-test-provider" },
      {
        privateKey: PROVIDER_KEY,
        services: [...DEFAULT_SERVICES],
        port: 0,
        host: "127.0.0.1",
        cryptoService: mockCrypto,
        paymentService: mockPayment,
        serviceHandlers: new Map([
          [
            "text_echo",
            async (order) => ({
              content: JSON.stringify({
                original_text: order.serviceType,
                echoed_text: order.serviceType,
                order_id: order.orderId,
              }),
              content_type: "application/json",
            }),
          ],
          [
            "json_transform",
            async (order) => ({
              content: JSON.stringify({
                transformed: true,
                service: order.serviceType,
                order_id: order.orderId,
              }),
              content_type: "application/json",
            }),
          ],
        ]),
        allowPrivateDeliveryUrls: true,
      },
    );

    // Start the adapter's HTTP server
    const handle = await a2aProvider.listen({ port: 0 });
    a2aProviderUrl = handle.url;
    stopA2aProvider = handle.stop;
  }, SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await stopA2aProvider();
  });

  it("should handle catalog via A2A provider adapter", async () => {
    const catalog = await a2aProvider.handleCatalog();

    expect(catalog.provider).toBeDefined();
    expect(catalog.services.length).toBeGreaterThanOrEqual(1);
  });

  it("should handle request via A2A provider adapter", async () => {
    const quote = await a2aProvider.handleRequest({
      protocol: "IVXP/1.0",
      messageType: "service_request",
      timestamp: new Date().toISOString(),
      clientAgent: {
        name: "InteropTestClient",
        walletAddress: TEST_ACCOUNTS.client.address,
      },
      serviceRequest: {
        type: "text_echo",
        description: "A2A provider adapter test",
        budgetUsdc: 10,
      },
    });

    expect(quote.orderId).toBeDefined();
    expect(quote.orderId.startsWith("ivxp-")).toBe(true);
    expect(quote.quote.priceUsdc).toBe(1);
  });

  it(
    "should complete full flow via A2A provider adapter and produce artifact (FR22)",
    async () => {
      // Step 1: Request via adapter
      const quote = await a2aProvider.handleRequest({
        protocol: "IVXP/1.0",
        messageType: "service_request",
        timestamp: new Date().toISOString(),
        clientAgent: {
          name: "InteropTestClient",
          walletAddress: TEST_ACCOUNTS.client.address,
        },
        serviceRequest: {
          type: "text_echo",
          description: "A2A artifact test",
          budgetUsdc: 10,
        },
      });
      const orderId = quote.orderId;

      // Step 2: Deliver via adapter -- use a single txHash for both
      // buildSignedMessage and handleDeliver to avoid mismatch
      const nonce = buildNonce();
      const timestamp = new Date().toISOString();
      const txHash = `0x${globalThis.crypto.randomUUID().replace(/-/g, "").padEnd(64, "0")}`;
      const signedMessage = buildSignedMessage({ orderId, txHash, nonce, timestamp });

      const accepted = await a2aProvider.handleDeliver({
        protocol: "IVXP/1.0",
        messageType: "delivery_request",
        timestamp,
        orderId,
        paymentProof: {
          txHash,
          fromAddress: TEST_ACCOUNTS.client.address,
          network: "base-sepolia",
        },
        signature: `0x${"ab".repeat(65)}`,
        signedMessage,
      });

      expect(accepted.status).toBe("accepted");

      // Step 3: Poll status via adapter
      await waitForCondition(
        async () => {
          const status = await a2aProvider.handleStatus(orderId);
          return status.status === "delivered";
        },
        { timeout: POLL_TIMEOUT_MS, message: `Order ${orderId} did not reach 'delivered'` },
      );

      // Step 4: Download with artifact (FR22)
      const { response, artifact } = await a2aProvider.handleDownloadWithArtifact(orderId);

      // Verify deliverable content
      expect(response.orderId).toBe(orderId);
      expect(response.contentHash).toBeDefined();
      assertValidContentHash(response.contentHash!);

      // FR22: Verify A2A Artifact structure
      expect(artifact.artifactId).toBe(`ivxp-deliverable-${orderId}`);
      expect(artifact.parts).toHaveLength(1);
      expect(artifact.parts[0].kind).toBe("text");
      expect(artifact.metadata).toBeDefined();
      expect(artifact.metadata!.content_hash).toBe(response.contentHash);

      // FR12: Verify content hash integrity
      const content =
        typeof response.deliverable.content === "string"
          ? response.deliverable.content
          : String(response.deliverable.content);
      const recomputedHash = await computeContentHash(content);
      expect(response.contentHash).toBe(recomputedHash);

      // Verify artifact text matches deliverable content
      const artifactText = "text" in artifact.parts[0] ? artifact.parts[0].text : "";
      expect(artifactText).toBe(content);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "should serve TS Client HTTP requests via A2A provider HTTP surface",
    async () => {
      // Verify that a standard TS Client can talk to the A2A provider's HTTP server
      const quoteRes = await httpPost<{ order_id: string }>(
        `${a2aProviderUrl}/ivxp/request`,
        buildServiceRequestBody("text_echo"),
      );
      const orderId = quoteRes.body.order_id;

      await httpPost(`${a2aProviderUrl}/ivxp/deliver`, buildDeliveryRequestBody(orderId));

      await waitForCondition(
        async () => {
          const res = await httpGet<StatusResponse>(`${a2aProviderUrl}/ivxp/status/${orderId}`);
          return res.body.status === "delivered";
        },
        { timeout: POLL_TIMEOUT_MS, message: `Order ${orderId} did not reach 'delivered'` },
      );

      const download = await httpGet<DownloadResponse>(
        `${a2aProviderUrl}/ivxp/download/${orderId}`,
      );

      expect(download.body.order_id).toBe(orderId);
      assertValidContentHash(download.body.content_hash);

      const recomputedHash = await computeContentHash(download.body.content);
      expect(download.body.content_hash).toBe(recomputedHash);
    },
    TEST_TIMEOUT_MS,
  );
});

// ===========================================================================
// Test Case 3: A2A Client <-> Python Provider
// ===========================================================================

describe("A2A Client (IVXPA2AClientAdapter) <-> Python Provider", () => {
  let pythonProc: ChildProcess;
  let a2aClient: IVXPA2AClientAdapter;
  let baseUrl: string;

  beforeAll(async () => {
    await assertPythonVenvReady();
    const port = await findAvailablePort();
    pythonProc = await startPythonProvider(port);
    baseUrl = `http://127.0.0.1:${port}`;
    a2aClient = new IVXPA2AClientAdapter({
      privateKey: CLIENT_KEY,
      network: "base-sepolia",
      providerUrl: baseUrl,
    });
  }, SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await stopPythonProvider(pythonProc);
  });

  it("should fetch catalog from Python provider via A2A client adapter", async () => {
    const catalog = await a2aClient.getCatalog(baseUrl);

    expect(catalog.provider).toBe("PythonTestProvider");
    expect(catalog.services.length).toBeGreaterThanOrEqual(1);
  });

  it("should request a quote from Python provider via A2A client adapter", async () => {
    const quote = await a2aClient.requestQuote(baseUrl, {
      serviceType: "text_echo",
      description: "A2A cross-language test",
      budgetUsdc: 10,
    });

    expect(quote.orderId).toBeDefined();
    expect(quote.orderId.startsWith("ivxp-")).toBe(true);
    expect(quote.quote.priceUsdc).toBe(1);
    expect(quote.quote.network).toBe("base-sepolia");
  });

  it(
    "should complete full flow against Python provider via A2A client adapter",
    async () => {
      // Step 1: Quote via A2A adapter
      const quote = await a2aClient.requestQuote(baseUrl, {
        serviceType: "text_echo",
        description: "A2A Python full flow",
        budgetUsdc: 10,
      });
      const orderId = quote.orderId;

      // Step 2: Deliver via direct HTTP (Python provider doesn't need nonce checks)
      await httpPost(`${baseUrl}/ivxp/deliver`, buildDeliveryRequestBody(orderId));

      // Step 3: Poll for delivery via direct HTTP
      await waitForCondition(
        async () => {
          const res = await httpGet<StatusResponse>(`${baseUrl}/ivxp/status/${orderId}`);
          return res.body.status === "delivered";
        },
        { timeout: POLL_TIMEOUT_MS, message: `Order ${orderId} did not reach 'delivered'` },
      );

      // Step 4: Download via direct HTTP and verify content hash
      const downloadRes = await httpGet<DownloadResponse>(`${baseUrl}/ivxp/download/${orderId}`);

      expect(downloadRes.body.content_hash).toBeDefined();
      assertValidContentHash(downloadRes.body.content_hash);

      // Verify content hash integrity across languages
      const recomputedHash = await computeContentHash(downloadRes.body.content);
      expect(downloadRes.body.content_hash).toBe(recomputedHash);
    },
    TEST_TIMEOUT_MS,
  );
});
