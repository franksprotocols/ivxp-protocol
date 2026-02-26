/**
 * @ivxp/sdk/provider
 *
 * Provider-side utilities for the IVXP SDK.
 *
 * @example
 * ```typescript
 * import { SSEOrderEmitter, createSSEStream, formatSSEEvent } from '@ivxp/sdk/provider';
 * ```
 */

export {
  SSEOrderEmitter,
  createSSEStream,
  formatSSEEvent,
  type SSEEventType,
  type SSEOrderEvent,
} from "./stream-endpoint.js";
