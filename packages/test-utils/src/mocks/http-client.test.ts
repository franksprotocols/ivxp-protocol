/**
 * Tests for MockHttpClient.
 */

import { describe, expect, it } from "vitest";
import { MockHttpClient } from "./http-client.js";

describe("MockHttpClient", () => {
  describe("get", () => {
    it("should throw when no route is registered and no default", async () => {
      const client = new MockHttpClient();
      await expect(client.get("/api/test")).rejects.toThrow("No route registered for GET");
    });

    it("should return default response when configured", async () => {
      const client = new MockHttpClient({
        defaultGetResponse: { ok: true },
      });
      const result = await client.get<{ ok: boolean }>("/api/test");
      expect(result).toEqual({ ok: true });
    });

    it("should use registered route handler", async () => {
      const client = new MockHttpClient();
      client.onGet("/api/catalog", () => ({
        services: ["code_review"],
      }));
      const result = await client.get<{ services: string[] }>("/api/catalog");
      expect(result.services).toContain("code_review");
    });

    it("should throw when getError is configured", async () => {
      const client = new MockHttpClient({
        getError: new Error("network down"),
      });
      await expect(client.get("/api/test")).rejects.toThrow("network down");
    });

    it("should record get calls", async () => {
      const client = new MockHttpClient({
        defaultGetResponse: {},
      });
      await client.get("/api/test", { timeout: 5000 });
      const calls = client.getGetCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe("/api/test");
      expect(calls[0].options?.timeout).toBe(5000);
    });
  });

  describe("post", () => {
    it("should throw when no route is registered and no default", async () => {
      const client = new MockHttpClient();
      await expect(client.post("/api/request", { type: "code_review" })).rejects.toThrow(
        "No route registered for POST",
      );
    });

    it("should return default response when configured", async () => {
      const client = new MockHttpClient({
        defaultPostResponse: { order_id: "ivxp-123" },
      });
      const result = await client.post<{ order_id: string }>("/api/request", {
        type: "code_review",
      });
      expect(result.order_id).toBe("ivxp-123");
    });

    it("should use registered route handler", async () => {
      const client = new MockHttpClient();
      client.onPost("/api/request", (_url, body) => ({
        order_id: "ivxp-from-handler",
        type: (body as { type: string })?.type,
      }));
      const result = await client.post<{ order_id: string; type: string }>("/api/request", {
        type: "code_review",
      });
      expect(result.order_id).toBe("ivxp-from-handler");
      expect(result.type).toBe("code_review");
    });

    it("should throw when postError is configured", async () => {
      const client = new MockHttpClient({
        postError: new Error("server error"),
      });
      await expect(client.post("/api/request", {})).rejects.toThrow("server error");
    });

    it("should record post calls", async () => {
      const client = new MockHttpClient({
        defaultPostResponse: {},
      });
      await client.post("/api/request", { data: "test" });
      const calls = client.getPostCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe("/api/request");
      expect(calls[0].body).toEqual({ data: "test" });
    });
  });

  describe("call management", () => {
    it("should track call counts", async () => {
      const client = new MockHttpClient({
        defaultGetResponse: {},
        defaultPostResponse: {},
      });
      await client.get("/a");
      await client.get("/b");
      await client.post("/c", {});
      expect(client.getGetCallCount()).toBe(2);
      expect(client.getPostCallCount()).toBe(1);
    });

    it("should reset calls", async () => {
      const client = new MockHttpClient({
        defaultGetResponse: {},
        defaultPostResponse: {},
      });
      await client.get("/a");
      await client.post("/b", {});
      client.resetCalls();
      expect(client.getGetCallCount()).toBe(0);
      expect(client.getPostCallCount()).toBe(0);
    });

    it("should clear routes", async () => {
      const client = new MockHttpClient();
      client.onGet("/test", () => ({}));
      client.clearRoutes();
      await expect(client.get("/test")).rejects.toThrow("No route registered");
    });
  });

  describe("route matching", () => {
    it("should match exact URLs", async () => {
      const client = new MockHttpClient();
      client.onGet("/api/catalog", () => ({ matched: true }));
      const result = await client.get<{ matched: boolean }>("/api/catalog");
      expect(result.matched).toBe(true);
    });

    it("should match URLs with query strings", async () => {
      const client = new MockHttpClient();
      client.onGet("/api/catalog", () => ({ matched: true }));
      const result = await client.get<{ matched: boolean }>("/api/catalog?page=1");
      expect(result.matched).toBe(true);
    });

    it("should match URLs with path extensions", async () => {
      const client = new MockHttpClient();
      client.onGet("/api/orders", () => ({ matched: true }));
      const result = await client.get<{ matched: boolean }>("/api/orders/123");
      expect(result.matched).toBe(true);
    });

    it("should NOT match partial path segments", async () => {
      const client = new MockHttpClient();
      client.onGet("/order", () => ({ matched: true }));
      await expect(client.get("/orders")).rejects.toThrow("No route registered");
      await expect(client.get("/reorder")).rejects.toThrow("No route registered");
    });
  });
});
