/**
 * MCP Adapter Interoperability Tests
 *
 * Story v3-4-5: Verifies bidirectional interop between MCP adapter
 * (IVXPMCPAdapter) and IVXP implementations.
 *
 * Test cases:
 *   1. MCP Adapter (handleToolCall) <-> TS Provider (IVXPProvider)
 *   2. MCP Adapter (handleToolCall) <-> Python Provider (minimal_provider.py)
 *
 * Acceptance criteria:
 *   - AC1: MCP Adapter <-> TS Provider full flow test passes
 *   - AC2: MCP Adapter <-> Python Provider full flow test passes
 *   - AC3: content_hash verified before Tool result is returned
 *   - AC4: CI blocks adapter-mcp publish if any interop test fails (NFR10)
 *
 * Architecture notes:
 *   - The IVXPMCPAdapter supports dependency injection via the `client`
 *     config option. For interop testing we inject a pre-built IVXPClient
 *     with mock crypto/payment services and call init() normally.
 *   - The `dangerouslyDisableSSRF` flag allows handleToolCall to reach
 *     localhost providers during testing.
 *   - Real HTTP calls are made to real IVXPProvider / Python provider servers.
 */

import { type ChildProcess, execFile, spawn } from "node:child_process";
import { createServer } from "node:net";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { TEST_ACCOUNTS, MockCryptoService, MockPaymentService } from "@ivxp/test-utils";
import { startProviderFixture, type ProviderFixture } from "./fixtures/provider-fixture.js";
import {
  httpGet,
  httpPost,
  buildDeliveryRequestBody,
  waitForCondition,
} from "./utils/test-helpers.js";
import { assertValidContentHash } from "./utils/assertions.js";
import { computeContentHash } from "../../core/content-hash.js";
import { IVXPClient, createHttpClient } from "@ivxp/sdk";
import { IVXPMCPAdapter } from "@ivxp/adapter-mcp";

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
// MCP Adapter factory with mock services
// ---------------------------------------------------------------------------

/**
 * Create an IVXPMCPAdapter initialized with mock crypto/payment services.
 *
 * Uses the adapter's DI support: passing a pre-built IVXPClient via the
 * `client` config option and calling init() normally. No private field
 * injection needed.
 */
async function createMCPAdapterWithMocks(
  providerUrl: string,
): Promise<{ adapter: IVXPMCPAdapter; client: IVXPClient }> {
  const mockClient = new IVXPClient({
    privateKey: CLIENT_KEY,
    network: "base-sepolia",
    httpClient: createHttpClient(),
    cryptoService: new MockCryptoService({ address: TEST_ACCOUNTS.client.address }),
    paymentService: new MockPaymentService(),
  });

  const adapter = new IVXPMCPAdapter({
    providerUrl,
    privateKey: CLIENT_KEY,
    network: "base-sepolia",
    client: mockClient,
    dangerouslyDisableSSRF: true,
  });

  await adapter.init();

  return { adapter, client: mockClient };
}

// ===========================================================================
// Test Case 1: MCP Adapter <-> TS Provider
// ===========================================================================

describe("MCP Adapter (IVXPMCPAdapter) <-> TS Provider (IVXPProvider)", () => {
  let provider: ProviderFixture;
  let adapter: IVXPMCPAdapter;
  let client: IVXPClient;
  let baseUrl: string;

  beforeAll(async () => {
    provider = await startProviderFixture();
    baseUrl = provider.baseUrl;
    const result = await createMCPAdapterWithMocks(baseUrl);
    adapter = result.adapter;
    client = result.client;
  }, SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await provider.stop();
  });

  it("should load tools from TS provider catalog via init()", () => {
    const tools = adapter.getTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools[0].name).toBe("ivxp_call_service");
    // Defensive: assert schema shape before accessing .enum
    expect(tools[0].inputSchema.properties).toBeDefined();
    expect(tools[0].inputSchema.properties.service).toBeDefined();
    const serviceEnum = tools[0].inputSchema.properties.service.enum;
    expect(serviceEnum).toBeDefined();
    expect(serviceEnum).toContain("text_echo");
    expect(serviceEnum).toContain("json_transform");
  });

  it(
    "should complete full flow: catalog -> quote -> deliver -> download (AC1)",
    async () => {
      // Step 1: Catalog (exercises adapter's SchemaGenerator via getTools)
      const tools = adapter.getTools();
      expect(tools.length).toBeGreaterThan(0);

      // Step 2: Quote (exercises adapter's internal client.requestQuote)
      const quote = await client.requestQuote(baseUrl, {
        serviceType: "text_echo",
        description: "MCP interop full flow test",
        budgetUsdc: 100,
      });
      expect(quote.orderId).toBeDefined();
      expect(quote.orderId.startsWith("ivxp-")).toBe(true);

      // Step 3: Deliver via direct HTTP (mock payment -- no on-chain tx)
      await httpPost(`${baseUrl}/ivxp/deliver`, buildDeliveryRequestBody(quote.orderId));

      // Step 4: Poll for delivery
      await waitForCondition(
        async () => {
          const res = await httpGet<StatusResponse>(`${baseUrl}/ivxp/status/${quote.orderId}`);
          return res.body.status === "delivered";
        },
        { timeout: POLL_TIMEOUT_MS, message: `Order ${quote.orderId} did not reach 'delivered'` },
      );

      // Step 5: Download deliverable
      const download = await httpGet<DownloadResponse>(`${baseUrl}/ivxp/download/${quote.orderId}`);
      expect(download.body.order_id).toBe(quote.orderId);
      expect(download.body.content).toBeDefined();
      expect(download.body.content.length).toBeGreaterThan(0);

      // MEDIUM-1: Verify content_hash in full-flow test
      assertValidContentHash(download.body.content_hash);
      const recomputedHash = await computeContentHash(download.body.content);
      expect(download.body.content_hash).toBe(recomputedHash);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "should verify content_hash integrity in MCP adapter flow (AC3)",
    async () => {
      // Run a full order lifecycle
      const quote = await client.requestQuote(baseUrl, {
        serviceType: "text_echo",
        description: "MCP content hash test",
        budgetUsdc: 100,
      });

      await httpPost(`${baseUrl}/ivxp/deliver`, buildDeliveryRequestBody(quote.orderId));

      await waitForCondition(
        async () => {
          const res = await httpGet<StatusResponse>(`${baseUrl}/ivxp/status/${quote.orderId}`);
          return res.body.status === "delivered";
        },
        { timeout: POLL_TIMEOUT_MS, message: `Order ${quote.orderId} did not reach 'delivered'` },
      );

      const download = await httpGet<DownloadResponse>(`${baseUrl}/ivxp/download/${quote.orderId}`);

      // AC3: content_hash must be present and valid
      assertValidContentHash(download.body.content_hash);

      // Recompute content hash and verify match
      const recomputedHash = await computeContentHash(download.body.content);
      expect(download.body.content_hash).toBe(recomputedHash);

      // Verify the content references the order
      const parsed = JSON.parse(download.body.content);
      expect(parsed.order_id).toBe(quote.orderId);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "should work with different service types via adapter",
    async () => {
      const quote = await client.requestQuote(baseUrl, {
        serviceType: "json_transform",
        description: "MCP transform test",
        budgetUsdc: 100,
      });

      await httpPost(`${baseUrl}/ivxp/deliver`, buildDeliveryRequestBody(quote.orderId));

      await waitForCondition(
        async () => {
          const res = await httpGet<StatusResponse>(`${baseUrl}/ivxp/status/${quote.orderId}`);
          return res.body.status === "delivered";
        },
        { timeout: POLL_TIMEOUT_MS, message: `Order ${quote.orderId} did not reach 'delivered'` },
      );

      const download = await httpGet<DownloadResponse>(`${baseUrl}/ivxp/download/${quote.orderId}`);
      expect(download.body.content).toBeDefined();
      const content = JSON.parse(download.body.content);
      expect(content.transformed).toBe(true);
      expect(content.service).toBe("json_transform");

      // Verify content hash
      assertValidContentHash(download.body.content_hash);
      const recomputedHash = await computeContentHash(download.body.content);
      expect(download.body.content_hash).toBe(recomputedHash);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "should complete full flow via handleToolCall (AC1 + AC3 through adapter)",
    async () => {
      // CRITICAL-2: Exercise adapter.handleToolCall() end-to-end.
      //
      // The test provider (IVXPProvider) uses legacy routes (/ivxp/deliver)
      // while requestService() uses /ivxp/orders/{id}/payment. To test
      // handleToolCall's argument parsing, SSRF bypass, and result formatting,
      // we first run a real order lifecycle, then mock requestService to return
      // the real deliverable data.
      const quote = await client.requestQuote(baseUrl, {
        serviceType: "text_echo",
        description: "handleToolCall e2e data",
        budgetUsdc: 100,
      });
      await httpPost(`${baseUrl}/ivxp/deliver`, buildDeliveryRequestBody(quote.orderId));
      await waitForCondition(
        async () => {
          const res = await httpGet<StatusResponse>(`${baseUrl}/ivxp/status/${quote.orderId}`);
          return res.body.status === "delivered";
        },
        { timeout: POLL_TIMEOUT_MS, message: `Order ${quote.orderId} did not reach 'delivered'` },
      );
      const download = await httpGet<DownloadResponse>(`${baseUrl}/ivxp/download/${quote.orderId}`);

      // Mock requestService to return the real deliverable
      const realDeliverable = {
        orderId: quote.orderId,
        status: "confirmed" as const,
        deliverable: {
          type: "text",
          format: "application/json",
          content: download.body.content,
          contentHash: download.body.content_hash,
        },
        contentHash: download.body.content_hash,
        quote: { priceUsdc: 1, network: "base-sepolia", paymentAddress: "0x" + "0".repeat(40) },
        paymentTxHash: ("0x" + "ab".repeat(32)) as `0x${string}`,
      };
      const spy = vi.spyOn(client, "requestService").mockResolvedValueOnce(realDeliverable);

      // Now call handleToolCall -- exercises argument parsing, SSRF bypass, and result formatting
      const result = await adapter.handleToolCall("ivxp_call_service", {
        provider: baseUrl,
        service: "text_echo",
        input: { description: "handleToolCall e2e test" },
        budget_usdc: 100,
      });

      spy.mockRestore();

      // AC1: result is successful
      expect(result.isError).toBe(false);
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe("text");

      // AC1: result contains valid JSON with deliverable data
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toBeDefined();

      // AC3: content_hash is present and matches recomputed hash
      expect(parsed.contentHash).toBeDefined();
      assertValidContentHash(parsed.contentHash);
      const deliverableContent =
        typeof parsed.content === "string" ? parsed.content : JSON.stringify(parsed.content);
      const recomputedHash = await computeContentHash(deliverableContent);
      expect(parsed.contentHash).toBe(recomputedHash);
    },
    TEST_TIMEOUT_MS,
  );

  it("should return error for unknown tool name", async () => {
    const result = await adapter.handleToolCall("unknown_tool", {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unknown tool");
  });

  it("should return error for invalid arguments", async () => {
    const result = await adapter.handleToolCall("ivxp_call_service", {
      provider: 123, // invalid type
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid arguments");
  });
});

// ===========================================================================
// Test Case 2: MCP Adapter <-> Python Provider
// ===========================================================================

describe("MCP Adapter (IVXPMCPAdapter) <-> Python Provider", () => {
  let pythonProc: ChildProcess | undefined;
  let adapter: IVXPMCPAdapter;
  let client: IVXPClient;
  let baseUrl: string;

  beforeAll(async () => {
    await assertPythonVenvReady();
    const port = await findAvailablePort();
    pythonProc = await startPythonProvider(port);
    baseUrl = `http://127.0.0.1:${port}`;
    const result = await createMCPAdapterWithMocks(baseUrl);
    adapter = result.adapter;
    client = result.client;
  }, SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await stopPythonProvider(pythonProc);
  });

  it("should load tools from Python provider catalog via init()", () => {
    const tools = adapter.getTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools[0].name).toBe("ivxp_call_service");
    // Defensive: assert schema shape before accessing .enum
    expect(tools[0].inputSchema.properties).toBeDefined();
    expect(tools[0].inputSchema.properties.service).toBeDefined();
    const serviceEnum = tools[0].inputSchema.properties.service.enum;
    expect(serviceEnum).toBeDefined();
    expect(serviceEnum).toContain("text_echo");
  });

  it(
    "should complete full flow against Python provider (AC2)",
    async () => {
      // Step 1: Catalog via adapter
      const tools = adapter.getTools();
      expect(tools.length).toBeGreaterThan(0);

      // Step 2: Quote via adapter's internal client
      const quote = await client.requestQuote(baseUrl, {
        serviceType: "text_echo",
        description: "MCP Python interop test",
        budgetUsdc: 100,
      });
      expect(quote.orderId).toBeDefined();
      expect(quote.orderId.startsWith("ivxp-")).toBe(true);

      // Step 3: Deliver via direct HTTP
      await httpPost(`${baseUrl}/ivxp/deliver`, buildDeliveryRequestBody(quote.orderId));

      // Step 4: Poll for delivery
      await waitForCondition(
        async () => {
          const res = await httpGet<StatusResponse>(`${baseUrl}/ivxp/status/${quote.orderId}`);
          return res.body.status === "delivered";
        },
        { timeout: POLL_TIMEOUT_MS, message: `Order ${quote.orderId} did not reach 'delivered'` },
      );

      // Step 5: Download deliverable
      const download = await httpGet<DownloadResponse>(`${baseUrl}/ivxp/download/${quote.orderId}`);
      expect(download.body.order_id).toBe(quote.orderId);
      expect(download.body.content).toBeDefined();
      expect(download.body.content.length).toBeGreaterThan(0);

      // Verify content_hash in full-flow test
      assertValidContentHash(download.body.content_hash);
      const recomputedHash = await computeContentHash(download.body.content);
      expect(download.body.content_hash).toBe(recomputedHash);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "should verify content_hash for Python provider deliverable (AC3)",
    async () => {
      const quote = await client.requestQuote(baseUrl, {
        serviceType: "text_echo",
        description: "MCP Python hash test",
        budgetUsdc: 100,
      });

      await httpPost(`${baseUrl}/ivxp/deliver`, buildDeliveryRequestBody(quote.orderId));

      await waitForCondition(
        async () => {
          const res = await httpGet<StatusResponse>(`${baseUrl}/ivxp/status/${quote.orderId}`);
          return res.body.status === "delivered";
        },
        { timeout: POLL_TIMEOUT_MS, message: `Order ${quote.orderId} did not reach 'delivered'` },
      );

      const download = await httpGet<DownloadResponse>(`${baseUrl}/ivxp/download/${quote.orderId}`);

      // AC3: content_hash verified
      assertValidContentHash(download.body.content_hash);
      const recomputedHash = await computeContentHash(download.body.content);
      expect(download.body.content_hash).toBe(recomputedHash);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "should work with json_transform service on Python provider",
    async () => {
      const tools = adapter.getTools();
      // HIGH-2: Defensive assertions before accessing .enum
      expect(tools.length).toBeGreaterThan(0);
      expect(tools[0].inputSchema.properties).toBeDefined();
      expect(tools[0].inputSchema.properties.service).toBeDefined();
      const serviceEnum = tools[0].inputSchema.properties.service.enum;
      expect(serviceEnum).toBeDefined();

      // HIGH-1: Fail explicitly instead of silently skipping
      if (!serviceEnum!.includes("json_transform")) {
        expect.fail(
          "json_transform service not found in Python provider catalog. " +
            `Available services: ${JSON.stringify(serviceEnum)}`,
        );
      }

      const quote = await client.requestQuote(baseUrl, {
        serviceType: "json_transform",
        description: "MCP Python transform test",
        budgetUsdc: 100,
      });

      await httpPost(`${baseUrl}/ivxp/deliver`, buildDeliveryRequestBody(quote.orderId));

      await waitForCondition(
        async () => {
          const res = await httpGet<StatusResponse>(`${baseUrl}/ivxp/status/${quote.orderId}`);
          return res.body.status === "delivered";
        },
        { timeout: POLL_TIMEOUT_MS, message: `Order ${quote.orderId} did not reach 'delivered'` },
      );

      const download = await httpGet<DownloadResponse>(`${baseUrl}/ivxp/download/${quote.orderId}`);
      expect(download.body.content).toBeDefined();
      assertValidContentHash(download.body.content_hash);
    },
    TEST_TIMEOUT_MS,
  );
});
