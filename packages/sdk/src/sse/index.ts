/**
 * SSE module exports.
 *
 * Provides SSEClient for connecting to Server-Sent Events streams,
 * SSEHandlers for event callbacks, SSEEvent for typed events,
 * and SSEExhaustedError for graceful degradation handling.
 */

export { SSEClient, SSEExhaustedError } from "./sse-client.js";
export type { SSEEvent, SSEHandlers, SSEClientOptions, SSEConnectOptions } from "./sse-client.js";
