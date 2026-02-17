/**
 * HttpClient unit tests.
 *
 * Tests the HTTP client implementation against the IHttpClient interface
 * from @ivxp/protocol. Covers successful requests, error mapping,
 * timeout handling, AbortSignal composition, Content-Type validation,
 * empty response handling, and injectable design.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { IHttpClient } from "@ivxp/protocol";
import { IVXPError } from "../errors/base.js";
import {
  SignatureVerificationError,
  PaymentVerificationError,
  OrderNotFoundError,
  ServiceUnavailableError,
} from "../errors/specific.js";
import { HttpClient, createHttpClient } from "./client.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Create a mock Response object for testing.
 *
 * The `body` option controls the text() return value (JSON-stringified)
 * and the json() return value (resolved directly).
 *
 * Defaults Content-Type to "application/json" unless overridden via
 * the `contentType` option.
 */
function createMockResponse(options: {
  ok: boolean;
  status: number;
  statusText: string;
  body?: unknown;
  contentType?: string;
}): Response {
  const bodyText = options.body !== undefined ? JSON.stringify(options.body) : "";
  const headers = new Headers();
  if (options.contentType !== undefined) {
    headers.set("Content-Type", options.contentType);
  } else if (bodyText.length > 0) {
    headers.set("Content-Type", "application/json");
  }

  return {
    ok: options.ok,
    status: options.status,
    statusText: options.statusText,
    json: () => Promise.resolve(options.body ?? {}),
    text: () => Promise.resolve(bodyText),
    headers,
    redirected: false,
    type: "basic",
    url: "",
    clone: () => ({}) as Response,
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

// ---------------------------------------------------------------------------
// HttpClient constructor
// ---------------------------------------------------------------------------

describe("HttpClient", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should create an instance with default options", () => {
      const client = new HttpClient();
      expect(client).toBeInstanceOf(HttpClient);
    });

    it("should accept custom baseUrl", () => {
      const client = new HttpClient({ baseUrl: "https://api.example.com" });
      expect(client).toBeInstanceOf(HttpClient);
    });

    it("should accept custom headers", () => {
      const client = new HttpClient({
        headers: { "X-Custom": "value" },
      });
      expect(client).toBeInstanceOf(HttpClient);
    });

    it("should accept custom timeout", () => {
      const client = new HttpClient({ timeout: 5000 });
      expect(client).toBeInstanceOf(HttpClient);
    });
  });

  // -------------------------------------------------------------------------
  // GET requests
  // -------------------------------------------------------------------------

  describe("get", () => {
    it("should make a GET request and parse JSON response", async () => {
      const mockData = { data: "test-value", count: 42 };
      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: "OK",
          body: mockData,
        }),
      );

      const client = new HttpClient();
      const result = await client.get<typeof mockData>("/test");

      expect(result).toEqual(mockData);
      expect(fetchSpy).toHaveBeenCalledOnce();
    });

    it("should prepend baseUrl to the request URL", async () => {
      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: "OK",
          body: {},
        }),
      );

      const client = new HttpClient({ baseUrl: "https://api.example.com" });
      await client.get("/endpoint");

      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.example.com/endpoint",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("should use the full URL when no baseUrl is set", async () => {
      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: "OK",
          body: {},
        }),
      );

      const client = new HttpClient();
      await client.get("https://full-url.example.com/test");

      expect(fetchSpy).toHaveBeenCalledWith(
        "https://full-url.example.com/test",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("should merge default headers with request-specific headers", async () => {
      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: "OK",
          body: {},
        }),
      );

      const client = new HttpClient({
        headers: { "X-Default": "default-val" },
      });
      await client.get("/test", {
        headers: { "X-Request": "request-val" },
      });

      const callArgs = fetchSpy.mock.calls[0];
      const requestInit = callArgs[1] as RequestInit;
      const headers = requestInit.headers as Record<string, string>;

      expect(headers["X-Default"]).toBe("default-val");
      expect(headers["X-Request"]).toBe("request-val");
    });

    it("should allow request headers to override default headers", async () => {
      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: "OK",
          body: {},
        }),
      );

      const client = new HttpClient({
        headers: { "Content-Type": "text/plain" },
      });
      await client.get("/test", {
        headers: { "Content-Type": "application/xml" },
      });

      const callArgs = fetchSpy.mock.calls[0];
      const requestInit = callArgs[1] as RequestInit;
      const headers = requestInit.headers as Record<string, string>;

      expect(headers["Content-Type"]).toBe("application/xml");
    });

    it("should not send a body for GET requests", async () => {
      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: "OK",
          body: {},
        }),
      );

      const client = new HttpClient();
      await client.get("/test");

      const callArgs = fetchSpy.mock.calls[0];
      const requestInit = callArgs[1] as RequestInit;
      expect(requestInit.body).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // POST requests
  // -------------------------------------------------------------------------

  describe("post", () => {
    it("should make a POST request with JSON body", async () => {
      const requestBody = { key: "value" };
      const responseData = { success: true };
      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: "OK",
          body: responseData,
        }),
      );

      const client = new HttpClient();
      const result = await client.post<typeof responseData>("/submit", requestBody);

      expect(result).toEqual(responseData);
      expect(fetchSpy).toHaveBeenCalledWith(
        "/submit",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(requestBody),
        }),
      );
    });

    it("should set Content-Type to application/json by default", async () => {
      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: "OK",
          body: {},
        }),
      );

      const client = new HttpClient();
      await client.post("/submit", { data: "test" });

      const callArgs = fetchSpy.mock.calls[0];
      const requestInit = callArgs[1] as RequestInit;
      const headers = requestInit.headers as Record<string, string>;

      expect(headers["Content-Type"]).toBe("application/json");
    });

    it("should handle null body", async () => {
      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: "OK",
          body: {},
        }),
      );

      const client = new HttpClient();
      await client.post("/submit", null);

      const callArgs = fetchSpy.mock.calls[0];
      const requestInit = callArgs[1] as RequestInit;
      expect(requestInit.body).toBe("null");
    });

    it("should serialize array body to JSON", async () => {
      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: "OK",
          body: {},
        }),
      );

      const client = new HttpClient();
      await client.post("/submit", [1, 2, 3]);

      const callArgs = fetchSpy.mock.calls[0];
      const requestInit = callArgs[1] as RequestInit;
      expect(requestInit.body).toBe("[1,2,3]");
    });

    it("should prepend baseUrl for POST requests", async () => {
      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: "OK",
          body: {},
        }),
      );

      const client = new HttpClient({ baseUrl: "https://api.example.com" });
      await client.post("/submit", { data: "test" });

      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.example.com/submit",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Empty response body handling (Issue #2)
  // -------------------------------------------------------------------------

  describe("empty response body", () => {
    it("should return undefined for 204 No Content response", async () => {
      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 204,
          statusText: "No Content",
          // body is undefined -> text() returns ""
        }),
      );

      const client = new HttpClient();
      const result = await client.get("/delete-resource");

      expect(result).toBeUndefined();
    });

    it("should return undefined for 200 with empty body", async () => {
      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: "OK",
          // body is undefined -> text() returns ""
        }),
      );

      const client = new HttpClient();
      const result = await client.get("/empty");

      expect(result).toBeUndefined();
    });

    it("should parse non-empty body normally", async () => {
      const data = { id: 1, name: "test" };
      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: "OK",
          body: data,
        }),
      );

      const client = new HttpClient();
      const result = await client.get<typeof data>("/data");

      expect(result).toEqual(data);
    });
  });

  // -------------------------------------------------------------------------
  // Content-Type validation (Issue #7)
  // -------------------------------------------------------------------------

  describe("Content-Type validation", () => {
    it("should throw ServiceUnavailableError for HTML content type", async () => {
      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: "OK",
          body: { data: "test" },
          contentType: "text/html",
        }),
      );

      const client = new HttpClient();

      await expect(client.get("/api")).rejects.toThrow(ServiceUnavailableError);
      // Verify error message includes the actual content type
      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: "OK",
          body: { data: "test" },
          contentType: "text/html; charset=utf-8",
        }),
      );
      try {
        await client.get("/api");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceUnavailableError);
        expect((error as ServiceUnavailableError).message).toContain("text/html");
      }
    });

    it("should throw ServiceUnavailableError for text/plain content type", async () => {
      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: "OK",
          body: { data: "test" },
          contentType: "text/plain",
        }),
      );

      const client = new HttpClient();

      await expect(client.get("/api")).rejects.toThrow(ServiceUnavailableError);
    });

    it("should accept application/json content type", async () => {
      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: "OK",
          body: { data: "test" },
          contentType: "application/json",
        }),
      );

      const client = new HttpClient();
      const result = await client.get<{ data: string }>("/api");

      expect(result).toEqual({ data: "test" });
    });

    it("should accept application/json with charset", async () => {
      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: "OK",
          body: { data: "test" },
          contentType: "application/json; charset=utf-8",
        }),
      );

      const client = new HttpClient();
      const result = await client.get<{ data: string }>("/api");

      expect(result).toEqual({ data: "test" });
    });

    it("should parse body when no Content-Type header is set", async () => {
      // Some APIs don't set Content-Type; we should still try to parse
      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: "OK",
          body: { data: "test" },
          contentType: "", // explicitly empty
        }),
      );

      const client = new HttpClient();
      const result = await client.get<{ data: string }>("/api");

      expect(result).toEqual({ data: "test" });
    });
  });

  // -------------------------------------------------------------------------
  // Error mapping (AC #1, AC #4)
  // -------------------------------------------------------------------------

  describe("error mapping", () => {
    it("should throw SignatureVerificationError for 401 status", async () => {
      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          status: 401,
          statusText: "Unauthorized",
          body: { message: "Invalid signature" },
        }),
      );

      const client = new HttpClient();

      await expect(client.get("/protected")).rejects.toThrow(SignatureVerificationError);
      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          status: 401,
          statusText: "Unauthorized",
          body: { message: "Invalid signature" },
        }),
      );
      await expect(client.get("/protected")).rejects.toMatchObject({
        message: "Invalid signature",
        code: "SIGNATURE_INVALID",
      });
    });

    it("should throw PaymentVerificationError for 402 status", async () => {
      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          status: 402,
          statusText: "Payment Required",
          body: { message: "Payment not verified" },
        }),
      );

      const client = new HttpClient();

      await expect(client.get("/paid")).rejects.toThrow(PaymentVerificationError);
    });

    it("should throw OrderNotFoundError for 404 status", async () => {
      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          status: 404,
          statusText: "Not Found",
          body: { message: "Order not found" },
        }),
      );

      const client = new HttpClient();

      await expect(client.get("/order/123")).rejects.toThrow(OrderNotFoundError);
    });

    it("should throw ServiceUnavailableError for 500 status", async () => {
      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          body: { message: "Server error" },
        }),
      );

      const client = new HttpClient();

      await expect(client.get("/api")).rejects.toThrow(ServiceUnavailableError);
    });

    it("should throw ServiceUnavailableError for 502 status", async () => {
      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          status: 502,
          statusText: "Bad Gateway",
          body: { message: "Bad gateway" },
        }),
      );

      const client = new HttpClient();

      await expect(client.get("/api")).rejects.toThrow(ServiceUnavailableError);
    });

    it("should throw ServiceUnavailableError for 503 status", async () => {
      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          status: 503,
          statusText: "Service Unavailable",
          body: { message: "Service unavailable" },
        }),
      );

      const client = new HttpClient();

      await expect(client.get("/api")).rejects.toThrow(ServiceUnavailableError);
    });

    it("should throw IVXPError with HTTP status code for unmapped client errors", async () => {
      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          status: 429,
          statusText: "Too Many Requests",
          body: { message: "Rate limited" },
        }),
      );

      const client = new HttpClient();

      try {
        await client.get("/api");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        const ivxpError = error as IVXPError;
        expect(ivxpError.code).toBe("HTTP_429");
        expect(ivxpError.message).toBe("Rate limited");
      }
    });

    it("should use statusText when error body has no message", async () => {
      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          status: 404,
          statusText: "Not Found",
          body: {},
        }),
      );

      const client = new HttpClient();

      try {
        await client.get("/missing");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(OrderNotFoundError);
        const orderError = error as OrderNotFoundError;
        expect(orderError.message).toBe("Not Found");
      }
    });

    it("should use statusText when error body message is not a string (Issue #3)", async () => {
      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          status: 404,
          statusText: "Not Found",
          body: { message: 12345 },
        }),
      );

      const client = new HttpClient();

      try {
        await client.get("/missing");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(OrderNotFoundError);
        const orderError = error as OrderNotFoundError;
        // Should fall back to statusText, not use the number
        expect(orderError.message).toBe("Not Found");
      }
    });

    it("should use statusText when error body message is a boolean (Issue #3)", async () => {
      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          body: { message: true },
        }),
      );

      const client = new HttpClient();

      try {
        await client.get("/api");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceUnavailableError);
        expect((error as ServiceUnavailableError).message).toBe("Internal Server Error");
      }
    });

    it("should handle non-JSON error response body gracefully", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: () => Promise.reject(new Error("Invalid JSON")),
        headers: new Headers(),
        redirected: false,
        type: "basic" as ResponseType,
        url: "",
        clone: () => ({}) as Response,
        body: null,
        bodyUsed: false,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        blob: () => Promise.resolve(new Blob()),
        formData: () => Promise.resolve(new FormData()),
        text: () => Promise.resolve("not json"),
        bytes: () => Promise.resolve(new Uint8Array()),
      } as Response;

      fetchSpy.mockResolvedValueOnce(mockResponse);

      const client = new HttpClient();

      try {
        await client.get("/api");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceUnavailableError);
        const svcError = error as ServiceUnavailableError;
        expect(svcError.message).toBe("Internal Server Error");
      }
    });

    it("should throw correct error for POST requests with error status", async () => {
      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          status: 402,
          statusText: "Payment Required",
          body: { message: "USDC transfer not verified" },
        }),
      );

      const client = new HttpClient();

      await expect(client.post("/order", { orderId: "test-123" })).rejects.toThrow(
        PaymentVerificationError,
      );
    });

    it("should ensure all HTTP errors are instances of IVXPError", async () => {
      const statusCodes = [401, 402, 404, 500, 502, 503, 429, 400];

      for (const status of statusCodes) {
        fetchSpy.mockResolvedValueOnce(
          createMockResponse({
            ok: false,
            status,
            statusText: "Error",
            body: { message: `Error ${status}` },
          }),
        );

        const client = new HttpClient();

        try {
          await client.get("/api");
          expect.fail(`Should have thrown for status ${status}`);
        } catch (error) {
          expect(error).toBeInstanceOf(IVXPError);
        }
      }
    });
  });

  // -------------------------------------------------------------------------
  // Timeout and abort signal (AC #3)
  // -------------------------------------------------------------------------

  describe("timeout and abort signal", () => {
    it("should throw ServiceUnavailableError on timeout with context (Issue #5)", async () => {
      fetchSpy.mockImplementationOnce(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            const signal = (init as RequestInit).signal;
            if (signal) {
              signal.addEventListener("abort", () => {
                reject(new DOMException("The operation was aborted.", "AbortError"));
              });
            }
          }),
      );

      const client = new HttpClient({ timeout: 50 });

      try {
        await client.get("/slow");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceUnavailableError);
        const svcError = error as ServiceUnavailableError;
        // Issue #5: message should include method, URL, and timeout
        expect(svcError.message).toContain("GET");
        expect(svcError.message).toContain("/slow");
        expect(svcError.message).toContain("50ms");
        expect(svcError.code).toBe("SERVICE_UNAVAILABLE");
      }
    });

    it("should use per-request timeout over default timeout", async () => {
      fetchSpy.mockImplementationOnce(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            const signal = (init as RequestInit).signal;
            if (signal) {
              signal.addEventListener("abort", () => {
                reject(new DOMException("The operation was aborted.", "AbortError"));
              });
            }
          }),
      );

      // Default is 30s but per-request is 50ms
      const client = new HttpClient({ timeout: 30000 });

      await expect(client.get("/slow", { timeout: 50 })).rejects.toThrow(ServiceUnavailableError);
    });

    it("should compose external abort signal with internal controller (Issue #1)", async () => {
      const externalController = new AbortController();

      fetchSpy.mockImplementationOnce(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            const signal = (init as RequestInit).signal;
            if (signal) {
              signal.addEventListener("abort", () => {
                reject(new DOMException("The operation was aborted.", "AbortError"));
              });
            }
          }),
      );

      const client = new HttpClient();
      const promise = client.get("/slow", { signal: externalController.signal });

      // Abort externally -- this should forward to the internal controller
      externalController.abort();

      await expect(promise).rejects.toThrow(ServiceUnavailableError);
    });

    it("should always pass internal controller.signal to fetch (Issue #1)", async () => {
      const externalController = new AbortController();

      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: "OK",
          body: { data: "test" },
        }),
      );

      const client = new HttpClient();
      await client.get("/test", { signal: externalController.signal });

      // Verify fetch received a signal that is NOT the external one
      // (it should be the internal controller's signal)
      const callArgs = fetchSpy.mock.calls[0];
      const requestInit = callArgs[1] as RequestInit;
      expect(requestInit.signal).not.toBe(externalController.signal);
      expect(requestInit.signal).toBeInstanceOf(AbortSignal);
    });

    it("should abort immediately when external signal is already aborted (Issue #1)", async () => {
      const externalController = new AbortController();
      externalController.abort(); // Abort before making request

      fetchSpy.mockImplementationOnce(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            const signal = (init as RequestInit).signal;
            if (signal) {
              // If already aborted, reject immediately
              if (signal.aborted) {
                reject(new DOMException("The operation was aborted.", "AbortError"));
                return;
              }
              signal.addEventListener("abort", () => {
                reject(new DOMException("The operation was aborted.", "AbortError"));
              });
            }
          }),
      );

      const client = new HttpClient();

      await expect(client.get("/test", { signal: externalController.signal })).rejects.toThrow(
        ServiceUnavailableError,
      );
    });

    it("should clean up external signal listener after successful request (Issue #1)", async () => {
      const externalController = new AbortController();
      const removeListenerSpy = vi.spyOn(externalController.signal, "removeEventListener");

      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: "OK",
          body: { data: "test" },
        }),
      );

      const client = new HttpClient();
      await client.get("/test", { signal: externalController.signal });

      expect(removeListenerSpy).toHaveBeenCalledWith("abort", expect.any(Function));
      removeListenerSpy.mockRestore();
    });

    it("should clean up external signal listener after failed request (Issue #1)", async () => {
      const externalController = new AbortController();
      const removeListenerSpy = vi.spyOn(externalController.signal, "removeEventListener");

      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          body: { message: "Error" },
        }),
      );

      const client = new HttpClient();
      try {
        await client.get("/test", { signal: externalController.signal });
      } catch {
        // Expected
      }

      expect(removeListenerSpy).toHaveBeenCalledWith("abort", expect.any(Function));
      removeListenerSpy.mockRestore();
    });

    it("should still timeout when external signal is provided (Issue #1)", async () => {
      const externalController = new AbortController();

      fetchSpy.mockImplementationOnce(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            const signal = (init as RequestInit).signal;
            if (signal) {
              signal.addEventListener("abort", () => {
                reject(new DOMException("The operation was aborted.", "AbortError"));
              });
            }
          }),
      );

      const client = new HttpClient({ timeout: 50 });

      // External signal is NOT aborted, but timeout should still fire
      await expect(client.get("/slow", { signal: externalController.signal })).rejects.toThrow(
        ServiceUnavailableError,
      );
    });

    it("should clear timeout on successful response", async () => {
      const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: "OK",
          body: { data: "test" },
        }),
      );

      const client = new HttpClient({ timeout: 5000 });
      await client.get("/test");

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it("should clear timeout on error response", async () => {
      const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          body: { message: "Error" },
        }),
      );

      const client = new HttpClient({ timeout: 5000 });
      try {
        await client.get("/test");
      } catch {
        // Expected
      }

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });

  // -------------------------------------------------------------------------
  // Network errors
  // -------------------------------------------------------------------------

  describe("network errors", () => {
    it("should wrap network errors as ServiceUnavailableError", async () => {
      fetchSpy.mockRejectedValueOnce(new TypeError("Failed to fetch"));

      const client = new HttpClient();

      try {
        await client.get("/api");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceUnavailableError);
        const svcError = error as ServiceUnavailableError;
        expect(svcError.message).toContain("Failed to fetch");
      }
    });

    it("should wrap unknown errors as ServiceUnavailableError", async () => {
      fetchSpy.mockRejectedValueOnce("string error");

      const client = new HttpClient();

      try {
        await client.get("/api");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceUnavailableError);
        const svcError = error as ServiceUnavailableError;
        expect(svcError.message).toContain("Unknown error");
      }
    });

    it("should not double-wrap IVXPError instances", async () => {
      const originalError = new OrderNotFoundError("Already mapped");
      fetchSpy.mockRejectedValueOnce(originalError);

      const client = new HttpClient();

      try {
        await client.get("/api");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBe(originalError);
        expect(error).toBeInstanceOf(OrderNotFoundError);
      }
    });
  });

  // -------------------------------------------------------------------------
  // IHttpClient interface compliance (AC #2)
  // -------------------------------------------------------------------------

  describe("IHttpClient compliance", () => {
    it("should satisfy the IHttpClient interface", () => {
      const client: IHttpClient = new HttpClient();
      expect(client.get).toBeTypeOf("function");
      expect(client.post).toBeTypeOf("function");
    });

    it("should work when typed as IHttpClient", async () => {
      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: "OK",
          body: { result: "ok" },
        }),
      );

      const client: IHttpClient = new HttpClient();
      const result = await client.get<{ result: string }>("/test");
      expect(result).toEqual({ result: "ok" });
    });
  });
});

// ---------------------------------------------------------------------------
// createHttpClient factory
// ---------------------------------------------------------------------------

describe("createHttpClient", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should create a client that implements IHttpClient", () => {
    const client: IHttpClient = createHttpClient();
    expect(client.get).toBeTypeOf("function");
    expect(client.post).toBeTypeOf("function");
  });

  it("should accept custom options", () => {
    const client = createHttpClient({
      baseUrl: "https://api.example.com",
      headers: { Authorization: "Bearer token" },
      timeout: 10000,
    });
    expect(client.get).toBeTypeOf("function");
  });

  it("should make requests with the configured baseUrl", async () => {
    fetchSpy.mockResolvedValueOnce(
      createMockResponse({
        ok: true,
        status: 200,
        statusText: "OK",
        body: { data: "test" },
      }),
    );

    const client = createHttpClient({ baseUrl: "https://api.example.com" });
    await client.get("/endpoint");

    expect(fetchSpy).toHaveBeenCalledWith("https://api.example.com/endpoint", expect.any(Object));
  });

  it("should work with no arguments (replaces createDefaultHttpClient)", () => {
    const client: IHttpClient = createHttpClient();
    expect(client.get).toBeTypeOf("function");
    expect(client.post).toBeTypeOf("function");
  });
});
