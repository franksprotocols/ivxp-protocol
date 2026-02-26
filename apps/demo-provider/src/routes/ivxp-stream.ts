/**
 * SSE stream route for the IVXP demo provider.
 *
 * Handles `GET /ivxp/stream/:order_id` — streams real-time order events
 * to subscribed clients via Server-Sent Events.
 *
 * @see Story v3-1-3 — Implement Provider SSE Endpoint
 */

import type { Request, Response } from "express";
import { createSSEStream, type SSEOrderEmitter } from "@ivxp/sdk/provider";

export interface StreamRouteHooks {
  readonly onStreamConnected?: (orderId: string) => void;
  readonly onStreamDisconnected?: (orderId: string) => void;
}

/**
 * Create the SSE stream route handler.
 *
 * @param emitter - The shared SSEOrderEmitter instance (singleton per server)
 */
export function createStreamRoute(
  emitter: SSEOrderEmitter,
  hooks: StreamRouteHooks = {},
) {
  return async function handleStream(req: Request, res: Response): Promise<void> {
    const rawParam = req.params["order_id"];
    const orderId = Array.isArray(rawParam) ? (rawParam[0] ?? "") : (rawParam ?? "");

    if (!orderId) {
      res.status(400).json({ error: "Missing order_id" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const stream = createSSEStream(orderId, emitter);
    hooks.onStreamConnected?.(orderId);
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let disconnected = false;

    req.on("close", () => {
      if (disconnected) {
        return;
      }
      disconnected = true;
      hooks.onStreamDisconnected?.(orderId);
      reader.cancel().catch(() => {
        // Ignore cancel errors on client disconnect
      });
    });

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value));
      }
    } finally {
      res.end();
    }
  };
}
