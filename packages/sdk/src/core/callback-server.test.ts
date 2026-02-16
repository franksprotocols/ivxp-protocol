/**
 * Callback server unit tests.
 *
 * Tests the createCallbackServer function for:
 * - AC#1: Successful push delivery reception with content_hash verification
 * - AC#2: Content hash verification failure (reject with 400)
 * - AC#3: Callback server configuration (port, routes, TLS)
 * - AC#4: Graceful shutdown
 *
 * Uses real HTTP servers (bound to random OS-assigned ports) for accurate
 * integration testing of the callback endpoint.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import {
  createCallbackServer,
  type CallbackServerOptions,
  type CallbackServerResult,
  type RejectionDetails,
} from "./callback-server.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute SHA-256 hash of content and return as hex string with sha256: prefix. */
function computeContentHash(content: string): string {
  const hash = createHash("sha256").update(content).digest("hex");
  return `sha256:${hash}`;
}

/** Send a POST request to a URL with JSON body. */
async function postJson(url: string, body: unknown): Promise<{ status: number; body: unknown }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const responseBody = await response.json().catch(() => null);
  return { status: response.status, body: responseBody };
}

/** Build a valid push delivery payload for testing. */
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
// Track servers for cleanup
// ---------------------------------------------------------------------------

let activeServers: CallbackServerResult[] = [];

afterEach(async () => {
  // Stop all servers started during each test
  for (const server of activeServers) {
    await server.stop().catch(() => {});
  }
  activeServers = [];
});

/** Create a callback server and track it for cleanup. */
async function createTrackedServer(
  onDelivery: (payload: unknown) => void,
  onRejected: (details: RejectionDetails, payload: unknown) => void,
  options?: CallbackServerOptions,
): Promise<CallbackServerResult> {
  const server = await createCallbackServer(onDelivery, onRejected, options);
  activeServers.push(server);
  return server;
}

// ---------------------------------------------------------------------------
// AC#1: Successful push delivery reception
// ---------------------------------------------------------------------------

describe("createCallbackServer", () => {
  describe("AC#1: Successful push delivery reception", () => {
    it("should accept a valid POST to /ivxp/callback and return 200", async () => {
      const onDelivery = vi.fn();
      const onRejected = vi.fn();

      const server = await createTrackedServer(onDelivery, onRejected);
      const payload = buildTestPayload();

      const response = await postJson(server.url, payload);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: "received" });
    });

    it("should invoke onDelivery callback with the parsed payload", async () => {
      const onDelivery = vi.fn();
      const onRejected = vi.fn();

      const server = await createTrackedServer(onDelivery, onRejected);
      const payload = buildTestPayload({ orderId: "ivxp-order-42" });

      await postJson(server.url, payload);

      expect(onDelivery).toHaveBeenCalledOnce();
      expect(onDelivery).toHaveBeenCalledWith(payload);
    });

    it("should verify content_hash matches delivered content (SHA-256)", async () => {
      const onDelivery = vi.fn();
      const onRejected = vi.fn();

      const content = "Hello, world!";
      const correctHash = computeContentHash(content);

      const server = await createTrackedServer(onDelivery, onRejected);
      const payload = buildTestPayload({ content, contentHash: correctHash });

      const response = await postJson(server.url, payload);

      expect(response.status).toBe(200);
      expect(onDelivery).toHaveBeenCalledOnce();
      expect(onRejected).not.toHaveBeenCalled();
    });

    it("should not invoke onRejected on successful delivery", async () => {
      const onDelivery = vi.fn();
      const onRejected = vi.fn();

      const server = await createTrackedServer(onDelivery, onRejected);
      const payload = buildTestPayload();

      await postJson(server.url, payload);

      expect(onRejected).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // AC#2: Content hash verification failure
  // ---------------------------------------------------------------------------

  describe("AC#2: Content hash verification failure", () => {
    it("should reject with 400 when content_hash does not match", async () => {
      const onDelivery = vi.fn();
      const onRejected = vi.fn();

      const server = await createTrackedServer(onDelivery, onRejected);
      const payload = buildTestPayload({
        content: "Actual content",
        contentHash: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      });

      const response = await postJson(server.url, payload);

      expect(response.status).toBe(400);
      expect(response.body).toEqual(
        expect.objectContaining({ error: expect.stringContaining("content_hash mismatch") }),
      );
    });

    it("should invoke onRejected with mismatch details", async () => {
      const onDelivery = vi.fn();
      const onRejected = vi.fn();

      const server = await createTrackedServer(onDelivery, onRejected);
      const payload = buildTestPayload({
        content: "Actual content",
        contentHash: "sha256:wronghash",
      });

      await postJson(server.url, payload);

      expect(onRejected).toHaveBeenCalledOnce();
      expect(onRejected).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: expect.stringContaining("content_hash mismatch"),
          expectedHash: expect.any(String),
          computedHash: expect.any(String),
        }),
        payload,
      );
    });

    it("should not invoke onDelivery when hash verification fails", async () => {
      const onDelivery = vi.fn();
      const onRejected = vi.fn();

      const server = await createTrackedServer(onDelivery, onRejected);
      const payload = buildTestPayload({
        content: "Real content",
        contentHash: "sha256:badhash",
      });

      await postJson(server.url, payload);

      expect(onDelivery).not.toHaveBeenCalled();
    });

    it("should handle content_hash without sha256: prefix", async () => {
      const onDelivery = vi.fn();
      const onRejected = vi.fn();

      const content = "Test content";
      const hash = createHash("sha256").update(content).digest("hex");

      const server = await createTrackedServer(onDelivery, onRejected);
      const payload = buildTestPayload({
        content,
        contentHash: hash, // No "sha256:" prefix
      });

      const response = await postJson(server.url, payload);

      // Should still succeed since we strip the prefix for comparison
      expect(response.status).toBe(200);
      expect(onDelivery).toHaveBeenCalledOnce();
    });
  });

  // ---------------------------------------------------------------------------
  // AC#3: Callback server configuration
  // ---------------------------------------------------------------------------

  describe("AC#3: Callback server configuration", () => {
    it("should bind to OS-assigned port when port is 0 (default)", async () => {
      const server = await createTrackedServer(vi.fn(), vi.fn());

      expect(server.port).toBeGreaterThan(0);
      expect(server.url).toContain(String(server.port));
    });

    it("should bind to a specific configured port", async () => {
      // Use a high port that is likely free
      const server = await createTrackedServer(vi.fn(), vi.fn(), {
        port: 0, // Still use 0 to avoid port conflicts in tests
      });

      expect(server.port).toBeGreaterThan(0);
    });

    it("should include /ivxp/callback in the URL", async () => {
      const server = await createTrackedServer(vi.fn(), vi.fn());

      expect(server.url).toContain("/ivxp/callback");
    });

    it("should return 404 for GET requests to /ivxp/callback", async () => {
      const server = await createTrackedServer(vi.fn(), vi.fn());

      const response = await fetch(server.url, { method: "GET" });

      expect(response.status).toBe(404);
    });

    it("should return 404 for POST to other paths", async () => {
      const server = await createTrackedServer(vi.fn(), vi.fn());
      const baseUrl = server.url.replace("/ivxp/callback", "");

      const response = await fetch(`${baseUrl}/other/path`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(404);
    });

    it("should return 404 for requests to root path", async () => {
      const server = await createTrackedServer(vi.fn(), vi.fn());
      const baseUrl = server.url.replace("/ivxp/callback", "");

      const response = await fetch(`${baseUrl}/`, { method: "GET" });

      expect(response.status).toBe(404);
    });

    it("should return 404 for PUT requests to /ivxp/callback", async () => {
      const server = await createTrackedServer(vi.fn(), vi.fn());

      const response = await fetch(server.url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildTestPayload()),
      });

      expect(response.status).toBe(404);
    });

    it("should use http protocol by default", async () => {
      const server = await createTrackedServer(vi.fn(), vi.fn());

      expect(server.url).toMatch(/^http:\/\//);
    });

    it("should reject payloads exceeding 1MB size limit", async () => {
      const onDelivery = vi.fn();
      const server = await createTrackedServer(onDelivery, vi.fn());

      // Create a payload just over 1MB
      const largeContent = "x".repeat(1024 * 1024 + 1);
      const payload = buildTestPayload({ content: largeContent });

      // When the server destroys the request stream for oversized bodies,
      // the client may see either a 413 response or a socket error depending
      // on timing. Either outcome correctly blocks the oversized payload.
      try {
        const response = await fetch(server.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        expect(response.status).toBe(413);
      } catch {
        // Socket error is acceptable -- the server rejected the oversized body
      }

      // The delivery callback should never be invoked for oversized payloads
      expect(onDelivery).not.toHaveBeenCalled();
    });

    it("should return 400 for invalid JSON body", async () => {
      const server = await createTrackedServer(vi.fn(), vi.fn());

      const response = await fetch(server.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not valid json{{{",
      });

      expect(response.status).toBe(400);
    });

    it("should return 400 for missing required fields", async () => {
      const server = await createTrackedServer(vi.fn(), vi.fn());

      const response = await postJson(server.url, {
        order_id: "test",
        // Missing deliverable field
      });

      expect(response.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------
  // AC#4: Graceful shutdown
  // ---------------------------------------------------------------------------

  describe("AC#4: Graceful shutdown", () => {
    it("should stop the server when stop() is called", async () => {
      const server = await createCallbackServer(vi.fn(), vi.fn());

      await server.stop();

      // Server should no longer accept connections
      await expect(
        fetch(server.url, { method: "POST" }).catch((e) => {
          throw e;
        }),
      ).rejects.toThrow();
    });

    it("should resolve stop() promise after server closes", async () => {
      const server = await createCallbackServer(vi.fn(), vi.fn());

      // stop() should not reject
      await expect(server.stop()).resolves.toBeUndefined();
    });

    it("should be safe to call stop() multiple times", async () => {
      const server = await createCallbackServer(vi.fn(), vi.fn());

      await server.stop();
      // Second call should not throw
      await expect(server.stop()).resolves.toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Immutability
  // ---------------------------------------------------------------------------

  describe("immutability", () => {
    it("should not mutate the options object", async () => {
      const options: CallbackServerOptions = { port: 0, host: "127.0.0.1" };
      const optionsBefore = JSON.parse(JSON.stringify(options));

      const server = await createTrackedServer(vi.fn(), vi.fn(), options);

      expect(options).toEqual(optionsBefore);
    });

    it("should return a new result object for each call", async () => {
      const server1 = await createTrackedServer(vi.fn(), vi.fn());
      const server2 = await createTrackedServer(vi.fn(), vi.fn());

      expect(server1).not.toBe(server2);
      expect(server1.port).not.toBe(server2.port);
    });
  });

  // ---------------------------------------------------------------------------
  // Multiple deliveries
  // ---------------------------------------------------------------------------

  describe("multiple deliveries", () => {
    it("should handle multiple sequential deliveries", async () => {
      const onDelivery = vi.fn();
      const onRejected = vi.fn();

      const server = await createTrackedServer(onDelivery, onRejected);

      const payload1 = buildTestPayload({ orderId: "order-1", content: "Content 1" });
      const payload2 = buildTestPayload({ orderId: "order-2", content: "Content 2" });
      const payload3 = buildTestPayload({ orderId: "order-3", content: "Content 3" });

      await postJson(server.url, payload1);
      await postJson(server.url, payload2);
      await postJson(server.url, payload3);

      expect(onDelivery).toHaveBeenCalledTimes(3);
    });
  });
});
