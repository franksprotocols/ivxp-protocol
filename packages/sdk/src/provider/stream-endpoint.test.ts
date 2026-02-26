/**
 * Unit tests for SSE stream endpoint utilities.
 *
 * Tests formatSSEEvent, SSEOrderEmitter, and createSSEStream.
 */

import { describe, it, expect, vi } from "vitest";
import { SSEOrderEmitter, formatSSEEvent, createSSEStream } from "./stream-endpoint.js";

describe("formatSSEEvent", () => {
  it("formats a status_update event correctly", () => {
    const result = formatSSEEvent("status_update", { status: "processing" });
    expect(result).toBe('event: status_update\ndata: {"status":"processing"}\n\n');
  });

  it("formats a progress event correctly", () => {
    const result = formatSSEEvent("progress", { percent: 75, message: "Generating report" });
    expect(result).toBe('event: progress\ndata: {"percent":75,"message":"Generating report"}\n\n');
  });

  it("formats a completed event correctly", () => {
    const result = formatSSEEvent("completed", {
      orderId: "abc123",
      deliverableUrl: "/ivxp/download/abc123",
    });
    expect(result).toBe(
      'event: completed\ndata: {"orderId":"abc123","deliverableUrl":"/ivxp/download/abc123"}\n\n',
    );
  });

  it("formats a failed event correctly", () => {
    const result = formatSSEEvent("failed", { orderId: "abc123", reason: "Provider error" });
    expect(result).toBe('event: failed\ndata: {"orderId":"abc123","reason":"Provider error"}\n\n');
  });
});

describe("SSEOrderEmitter", () => {
  it("dispatches events to subscribers for the correct order", () => {
    const emitter = new SSEOrderEmitter();
    const listener = vi.fn();
    emitter.subscribe("order-1", listener);
    emitter.push("order-1", { type: "progress", data: { percent: 50 } });
    expect(listener).toHaveBeenCalledWith({ type: "progress", data: { percent: 50 } });
  });

  it("does not dispatch to subscribers of a different order", () => {
    const emitter = new SSEOrderEmitter();
    const listener = vi.fn();
    emitter.subscribe("order-2", listener);
    emitter.push("order-1", { type: "progress", data: {} });
    expect(listener).not.toHaveBeenCalled();
  });

  it("returns an unsubscribe function that stops event delivery", () => {
    const emitter = new SSEOrderEmitter();
    const listener = vi.fn();
    const unsubscribe = emitter.subscribe("order-1", listener);
    unsubscribe();
    emitter.push("order-1", { type: "progress", data: {} });
    expect(listener).not.toHaveBeenCalled();
  });

  it("dispatches to multiple subscribers for the same order", () => {
    const emitter = new SSEOrderEmitter();
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    emitter.subscribe("order-1", listener1);
    emitter.subscribe("order-1", listener2);
    emitter.push("order-1", { type: "status_update", data: { status: "processing" } });
    expect(listener1).toHaveBeenCalledOnce();
    expect(listener2).toHaveBeenCalledOnce();
  });

  it("tracks subscriber counts by order", () => {
    const emitter = new SSEOrderEmitter();
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    expect(emitter.getSubscriberCount("order-1")).toBe(0);
    expect(emitter.hasSubscribers("order-1")).toBe(false);

    const unsubscribe1 = emitter.subscribe("order-1", listener1);
    expect(emitter.getSubscriberCount("order-1")).toBe(1);
    expect(emitter.hasSubscribers("order-1")).toBe(true);

    const unsubscribe2 = emitter.subscribe("order-1", listener2);
    expect(emitter.getSubscriberCount("order-1")).toBe(2);

    unsubscribe1();
    expect(emitter.getSubscriberCount("order-1")).toBe(1);

    unsubscribe2();
    expect(emitter.getSubscriberCount("order-1")).toBe(0);
    expect(emitter.hasSubscribers("order-1")).toBe(false);
  });
});

describe("createSSEStream", () => {
  it("sends initial keep-alive comment on connect", async () => {
    const emitter = new SSEOrderEmitter();
    const stream = createSSEStream("order-1", emitter);
    const reader = stream.getReader();

    const { value } = await reader.read();
    const decoder = new TextDecoder();
    expect(decoder.decode(value)).toBe(": connected\n\n");

    await reader.cancel();
  });

  it("removes subscriber on client disconnect", async () => {
    const emitter = new SSEOrderEmitter();
    const stream = createSSEStream("order-1", emitter);
    const reader = stream.getReader();

    await reader.read();
    expect(emitter.getSubscriberCount("order-1")).toBe(1);

    await reader.cancel();
    expect(emitter.getSubscriberCount("order-1")).toBe(0);
  });

  it("closes the stream on completed event", async () => {
    const emitter = new SSEOrderEmitter();
    const stream = createSSEStream("order-1", emitter);
    const reader = stream.getReader();

    // Read initial keep-alive
    await reader.read();

    // Push completed event
    emitter.push("order-1", { type: "completed", data: { orderId: "order-1" } });

    const chunks: string[] = [];
    const decoder = new TextDecoder();
    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (result.value) chunks.push(decoder.decode(result.value));
    }

    expect(chunks.join("")).toContain("event: completed");
  });

  it("closes the stream on failed event", async () => {
    const emitter = new SSEOrderEmitter();
    const stream = createSSEStream("order-1", emitter);
    const reader = stream.getReader();

    // Read initial keep-alive
    await reader.read();

    // Push failed event
    emitter.push("order-1", { type: "failed", data: { orderId: "order-1", reason: "error" } });

    const chunks: string[] = [];
    const decoder = new TextDecoder();
    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (result.value) chunks.push(decoder.decode(result.value));
    }

    expect(chunks.join("")).toContain("event: failed");
  });

  it("streams progress events before terminal event", async () => {
    const emitter = new SSEOrderEmitter();
    const stream = createSSEStream("order-1", emitter);
    const reader = stream.getReader();

    // Read initial keep-alive
    await reader.read();

    // Push progress then completed
    emitter.push("order-1", { type: "progress", data: { percent: 50 } });
    emitter.push("order-1", { type: "completed", data: { orderId: "order-1" } });

    const chunks: string[] = [];
    const decoder = new TextDecoder();
    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (result.value) chunks.push(decoder.decode(result.value));
    }

    const output = chunks.join("");
    expect(output).toContain("event: progress");
    expect(output).toContain("event: completed");
  });
});
