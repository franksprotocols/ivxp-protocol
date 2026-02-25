/**
 * SSEClient unit tests.
 *
 * Tests all 4 SSE event types, 3-retry exhaustion, reconnect behavior,
 * and abortable connection attempts.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { SSEClient, SSEExhaustedError } from "./sse-client.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSseStream(events: string[], keepOpen = false): Response {
  const body = new ReadableStream({
    start(controller) {
      for (const chunk of events) {
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      if (!keepOpen) {
        controller.close();
      }
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function makeErrorResponse(status: number): Response {
  return new Response(null, { status });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SSEClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("dispatches all 4 event types to handlers", async () => {
    const chunks = [
      "event: status_update\ndata: {\"status\":\"processing\"}\n\n",
      "event: progress\ndata: {\"pct\":50}\n\n",
      "event: completed\ndata: {\"orderId\":\"abc\"}\n\n",
      "event: failed\ndata: {\"reason\":\"timeout\"}\n\n",
    ];
    vi.stubGlobal("fetch", async () => makeSseStream(chunks));

    const handlers = {
      onStatusUpdate: vi.fn(),
      onProgress: vi.fn(),
      onCompleted: vi.fn(),
      onFailed: vi.fn(),
    };

    const client = new SSEClient();
    const unsub = await client.connect("http://provider/stream/1", handlers);
    await delay(50); // let read loop drain
    unsub();

    expect(handlers.onStatusUpdate).toHaveBeenCalledWith({ status: "processing" });
    expect(handlers.onProgress).toHaveBeenCalledWith({ pct: 50 });
    expect(handlers.onCompleted).toHaveBeenCalledWith({ orderId: "abc" });
    expect(handlers.onFailed).toHaveBeenCalledWith({ reason: "timeout" });
  });

  it("throws SSEExhaustedError after 3 failed initial connection attempts", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("ECONNREFUSED");
    });
    const client = new SSEClient({ maxRetries: 3, retryBaseMs: 0 });
    await expect(client.connect("http://unreachable/stream/1", {})).rejects.toBeInstanceOf(
      SSEExhaustedError,
    );
  });

  it("retries on non-ok HTTP response before connecting", async () => {
    let callCount = 0;
    vi.stubGlobal("fetch", async () => {
      callCount += 1;
      if (callCount < 3) {
        return makeErrorResponse(503);
      }
      return makeSseStream(["event: completed\ndata: {}\n\n"], true);
    });

    const client = new SSEClient({ maxRetries: 3, retryBaseMs: 0 });
    const handlers = { onCompleted: vi.fn() };
    const unsub = await client.connect("http://provider/stream/1", handlers);
    await delay(30);
    unsub();

    expect(callCount).toBe(3);
  });

  it("throws SSEExhaustedError after 3 non-ok initial HTTP responses", async () => {
    vi.stubGlobal("fetch", async () => makeErrorResponse(503));
    const client = new SSEClient({ maxRetries: 3, retryBaseMs: 0 });
    await expect(client.connect("http://provider/stream/1", {})).rejects.toBeInstanceOf(
      SSEExhaustedError,
    );
  });

  it("unsubscribe function cancels the stream", async () => {
    const cancelSpy = vi.fn();
    const body = new ReadableStream({
      start(controller) {
        // Never close — simulates a long-running stream
        controller.enqueue(new TextEncoder().encode("event: status_update\ndata: {}\n\n"));
      },
      cancel() {
        cancelSpy();
      },
    });
    vi.stubGlobal("fetch", async () => new Response(body, { status: 200 }));

    const client = new SSEClient();
    const unsub = await client.connect("http://provider/stream/1", {});
    unsub();

    await delay(20);
    expect(cancelSpy).toHaveBeenCalled();
  });

  it("handles non-JSON data gracefully (passes raw string)", async () => {
    const chunks = ["event: status_update\ndata: plain-text\n\n"];
    vi.stubGlobal("fetch", async () => makeSseStream(chunks));

    const handlers = { onStatusUpdate: vi.fn() };
    const client = new SSEClient();
    const unsub = await client.connect("http://provider/stream/1", handlers);
    await delay(30);
    unsub();

    expect(handlers.onStatusUpdate).toHaveBeenCalledWith("plain-text");
  });

  it("ignores unknown event types", async () => {
    const chunks = ["event: unknown_type\ndata: {\"x\":1}\n\n"];
    vi.stubGlobal("fetch", async () => makeSseStream(chunks));

    const handlers = {
      onStatusUpdate: vi.fn(),
      onProgress: vi.fn(),
      onCompleted: vi.fn(),
      onFailed: vi.fn(),
    };
    const client = new SSEClient();
    const unsub = await client.connect("http://provider/stream/1", handlers);
    await delay(30);
    unsub();

    expect(handlers.onStatusUpdate).not.toHaveBeenCalled();
    expect(handlers.onProgress).not.toHaveBeenCalled();
    expect(handlers.onCompleted).not.toHaveBeenCalled();
    expect(handlers.onFailed).not.toHaveBeenCalled();
  });

  it("reconnects after mid-stream disconnect and continues receiving events", async () => {
    let callCount = 0;
    vi.stubGlobal("fetch", async () => {
      callCount += 1;
      if (callCount === 1) {
        // First stream disconnects after one event
        return makeSseStream(["event: status_update\ndata: {\"phase\":\"processing\"}\n\n"]);
      }
      // Reconnected stream remains open after terminal event to avoid extra reconnect loops
      return makeSseStream(["event: completed\ndata: {\"ok\":true}\n\n"], true);
    });

    const handlers = {
      onStatusUpdate: vi.fn(),
      onCompleted: vi.fn(),
    };

    const client = new SSEClient({ maxRetries: 3, retryBaseMs: 0 });
    const unsub = await client.connect("http://provider/stream/1", handlers);

    await delay(80);
    unsub();

    expect(callCount).toBe(2);
    expect(handlers.onStatusUpdate).toHaveBeenCalledWith({ phase: "processing" });
    expect(handlers.onCompleted).toHaveBeenCalledWith({ ok: true });
  });

  it("reports onExhausted when reconnect retries are exhausted after disconnect", async () => {
    let callCount = 0;
    vi.stubGlobal("fetch", async () => {
      callCount += 1;
      if (callCount === 1) {
        // Initial connect succeeds, then closes mid-stream.
        return makeSseStream(["event: status_update\ndata: {\"phase\":\"processing\"}\n\n"]);
      }
      throw new Error("ECONNREFUSED");
    });

    const onExhausted = vi.fn();
    const exhaustedPromise = new Promise<void>((resolve) => {
      onExhausted.mockImplementation(() => {
        resolve();
      });
    });

    const handlers = {
      onStatusUpdate: vi.fn(),
      onExhausted,
    };

    const client = new SSEClient({ maxRetries: 3, retryBaseMs: 0 });
    const unsub = await client.connect("http://provider/stream/1", handlers);

    await exhaustedPromise;
    unsub();

    expect(callCount).toBe(4); // 1 successful connect + 3 failed reconnect attempts
    expect(handlers.onStatusUpdate).toHaveBeenCalledTimes(1);
    expect(onExhausted).toHaveBeenCalledTimes(1);
    expect(onExhausted.mock.calls[0]?.[0]).toBeInstanceOf(SSEExhaustedError);
  });

  it("honors AbortSignal during connection attempts", async () => {
    vi.stubGlobal("fetch", (_url: string | URL | Request, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) {
          return;
        }
        if (signal.aborted) {
          reject(new Error("Aborted"));
          return;
        }
        signal.addEventListener(
          "abort",
          () => {
            reject(new Error("Aborted"));
          },
          { once: true },
        );
      });
    });

    const abortController = new AbortController();
    const client = new SSEClient({ maxRetries: 3, retryBaseMs: 0 });

    const connectPromise = client.connect(
      "http://provider/stream/1",
      {},
      { signal: abortController.signal },
    );

    setTimeout(() => {
      abortController.abort();
    }, 10);

    await expect(connectPromise).rejects.toThrow("Aborted");
  });
});
