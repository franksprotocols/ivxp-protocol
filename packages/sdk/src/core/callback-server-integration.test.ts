/**
 * IVXPClient callback server integration tests.
 *
 * Tests the callback server lifecycle methods on IVXPClient:
 * - startCallbackServer()
 * - stopCallbackServer()
 * - getCallbackUrl()
 * - isCallbackServerRunning()
 * - Event emission (delivery.received, delivery.rejected)
 *
 * Uses real HTTP servers (OS-assigned ports) for accurate testing.
 */

import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  MockCryptoService,
  MockPaymentService,
  MockHttpClient,
  TEST_ACCOUNTS,
} from "@ivxp/test-utils";
import { IVXPClient, type IVXPClientConfig } from "./client.js";
import { IVXPError } from "../errors/base.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a fully mocked IVXPClient for testing. */
function createTestClient(callbackServer?: IVXPClientConfig["callbackServer"]): IVXPClient {
  return new IVXPClient({
    privateKey: TEST_ACCOUNTS.client.privateKey as `0x${string}`,
    cryptoService: new MockCryptoService({
      address: TEST_ACCOUNTS.client.address,
    }),
    paymentService: new MockPaymentService(),
    httpClient: new MockHttpClient({}),
    callbackServer,
  });
}

/** Compute SHA-256 hash with sha256: prefix. */
function computeContentHash(content: string): string {
  const hash = createHash("sha256").update(content).digest("hex");
  return `sha256:${hash}`;
}

/** POST JSON to a URL. */
async function postJson(url: string, body: unknown): Promise<{ status: number; body: unknown }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const responseBody = await response.json().catch(() => null);
  return { status: response.status, body: responseBody };
}

/** Build a valid push delivery payload. */
function buildTestPayload(overrides?: {
  orderId?: string;
  content?: string;
  contentHash?: string;
  format?: string;
}) {
  const content = overrides?.content ?? "# Test Report\nAnalysis complete.";
  const contentHash = overrides?.contentHash ?? computeContentHash(content);
  return {
    order_id: overrides?.orderId ?? "ivxp-test-order-001",
    status: "delivered" as const,
    deliverable: {
      content,
      content_hash: contentHash,
      format: overrides?.format ?? "markdown",
    },
    delivered_at: "2026-02-16T12:00:00Z",
  };
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

let activeClients: IVXPClient[] = [];

afterEach(async () => {
  for (const client of activeClients) {
    await client.stopCallbackServer().catch(() => {});
  }
  activeClients = [];
});

/** Create a client and track it for cleanup. */
function createTrackedClient(callbackServer?: IVXPClientConfig["callbackServer"]): IVXPClient {
  const client = createTestClient(callbackServer);
  activeClients.push(client);
  return client;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("IVXPClient callback server integration", () => {
  // -------------------------------------------------------------------------
  // startCallbackServer()
  // -------------------------------------------------------------------------

  describe("startCallbackServer()", () => {
    it("should start a callback server and return result with URL and port", async () => {
      const client = createTrackedClient();

      const result = await client.startCallbackServer();

      expect(result.url).toContain("/ivxp/callback");
      expect(result.port).toBeGreaterThan(0);
      expect(result.stop).toBeInstanceOf(Function);
    });

    it("should use config options when no override provided", async () => {
      const client = createTrackedClient({ port: 0, host: "127.0.0.1" });

      const result = await client.startCallbackServer();

      expect(result.url).toContain("127.0.0.1");
    });

    it("should use override options when provided", async () => {
      const client = createTrackedClient({ host: "0.0.0.0" });

      const result = await client.startCallbackServer({ host: "127.0.0.1" });

      expect(result.url).toContain("127.0.0.1");
    });

    it("should throw if callback server is already running", async () => {
      const client = createTrackedClient();

      await client.startCallbackServer();

      await expect(client.startCallbackServer()).rejects.toThrow(IVXPError);
      await expect(client.startCallbackServer()).rejects.toThrow("already running");
    });
  });

  // -------------------------------------------------------------------------
  // stopCallbackServer()
  // -------------------------------------------------------------------------

  describe("stopCallbackServer()", () => {
    it("should stop the running callback server", async () => {
      const client = createTrackedClient();
      await client.startCallbackServer();

      expect(client.isCallbackServerRunning()).toBe(true);

      await client.stopCallbackServer();

      expect(client.isCallbackServerRunning()).toBe(false);
    });

    it("should be a no-op when no server is running", async () => {
      const client = createTrackedClient();

      // Should not throw
      await expect(client.stopCallbackServer()).resolves.toBeUndefined();
    });

    it("should allow starting a new server after stopping", async () => {
      const client = createTrackedClient();

      await client.startCallbackServer();
      await client.stopCallbackServer();

      // Should not throw
      const result = await client.startCallbackServer();
      expect(result.port).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // getCallbackUrl()
  // -------------------------------------------------------------------------

  describe("getCallbackUrl()", () => {
    it("should return undefined when server is not running", () => {
      const client = createTrackedClient();

      expect(client.getCallbackUrl()).toBeUndefined();
    });

    it("should return the callback URL when server is running", async () => {
      const client = createTrackedClient();
      const result = await client.startCallbackServer();

      expect(client.getCallbackUrl()).toBe(result.url);
    });

    it("should return undefined after server is stopped", async () => {
      const client = createTrackedClient();
      await client.startCallbackServer();
      await client.stopCallbackServer();

      expect(client.getCallbackUrl()).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // isCallbackServerRunning()
  // -------------------------------------------------------------------------

  describe("isCallbackServerRunning()", () => {
    it("should return false initially", () => {
      const client = createTrackedClient();

      expect(client.isCallbackServerRunning()).toBe(false);
    });

    it("should return true after starting", async () => {
      const client = createTrackedClient();
      await client.startCallbackServer();

      expect(client.isCallbackServerRunning()).toBe(true);
    });

    it("should return false after stopping", async () => {
      const client = createTrackedClient();
      await client.startCallbackServer();
      await client.stopCallbackServer();

      expect(client.isCallbackServerRunning()).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Event emission: delivery.received
  // -------------------------------------------------------------------------

  describe("delivery.received event", () => {
    it("should emit delivery.received when valid delivery is pushed", async () => {
      const client = createTrackedClient();
      const result = await client.startCallbackServer();

      const events: Array<{ orderId: string; contentHash: string; format: string }> = [];
      client.on("delivery.received", (payload) => {
        events.push(payload);
      });

      const payload = buildTestPayload({
        orderId: "ivxp-push-order-1",
        content: "Delivery content",
        format: "json",
      });

      await postJson(result.url, payload);

      expect(events).toHaveLength(1);
      expect(events[0].orderId).toBe("ivxp-push-order-1");
      expect(events[0].format).toBe("json");
      expect(events[0].contentHash).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Event emission: delivery.rejected
  // -------------------------------------------------------------------------

  describe("delivery.rejected event", () => {
    it("should emit delivery.rejected when content hash mismatches", async () => {
      const client = createTrackedClient();
      const result = await client.startCallbackServer();

      const events: Array<{
        orderId: string;
        reason: string;
        expectedHash: string;
        computedHash: string;
      }> = [];
      client.on("delivery.rejected", (payload) => {
        events.push(payload);
      });

      const payload = buildTestPayload({
        orderId: "ivxp-bad-hash-order",
        content: "Real content",
        contentHash: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      });

      await postJson(result.url, payload);

      expect(events).toHaveLength(1);
      expect(events[0].orderId).toBe("ivxp-bad-hash-order");
      expect(events[0].reason).toContain("content_hash mismatch");
    });

    it("should not emit delivery.received when hash mismatches", async () => {
      const client = createTrackedClient();
      const result = await client.startCallbackServer();

      const receivedEvents: unknown[] = [];
      client.on("delivery.received", (payload) => {
        receivedEvents.push(payload);
      });

      const payload = buildTestPayload({
        content: "Content",
        contentHash: "sha256:badhash",
      });

      await postJson(result.url, payload);

      expect(receivedEvents).toHaveLength(0);
    });
  });
});
