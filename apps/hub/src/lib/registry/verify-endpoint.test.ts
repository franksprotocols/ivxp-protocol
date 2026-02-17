import { describe, it, expect, vi, afterEach } from "vitest";
import { verifyProviderEndpoint } from "./verify-endpoint";

describe("verifyProviderEndpoint", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns reachable true for 200 response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });

    const result = await verifyProviderEndpoint("https://test.example.com");

    expect(result.reachable).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://test.example.com/ivxp/catalog",
      expect.objectContaining({ method: "HEAD" }),
    );
  });

  it("returns reachable false for non-2xx response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    });

    const result = await verifyProviderEndpoint("https://test.example.com");

    expect(result.reachable).toBe(false);
    expect(result.error).toContain("503");
  });

  it("returns reachable false for network error", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await verifyProviderEndpoint("https://test.example.com");

    expect(result.reachable).toBe(false);
    expect(result.error).toContain("ECONNREFUSED");
  });

  it("returns reachable false for timeout", async () => {
    const abortError = new DOMException("Aborted", "AbortError");
    globalThis.fetch = vi.fn().mockRejectedValue(abortError);

    const result = await verifyProviderEndpoint("https://test.example.com");

    expect(result.reachable).toBe(false);
    expect(result.error).toContain("did not respond within");
  });

  it("strips trailing slash from endpoint_url", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    await verifyProviderEndpoint("https://test.example.com/");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://test.example.com/ivxp/catalog",
      expect.any(Object),
    );
  });
});
