/**
 * SSEClient -- Server-Sent Events client with graceful degradation.
 *
 * Connects to an SSE stream and dispatches typed events to handlers.
 * Retries up to `maxRetries` times on connection failure before throwing
 * `SSEExhaustedError` (caller should fall back to polling).
 *
 * Uses the Fetch API's ReadableStream for Node.js 18+ compatibility.
 * No external dependencies.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Typed SSE event dispatched to handlers.
 */
export interface SSEEvent {
  readonly type: "status_update" | "progress" | "completed" | "failed";
  readonly data: unknown;
}

/**
 * Handlers for SSE event types.
 * All handlers are optional — unhandled event types are silently ignored.
 */
export interface SSEHandlers {
  readonly onStatusUpdate?: (data: unknown) => void;
  readonly onProgress?: (data: unknown) => void;
  readonly onCompleted?: (data: unknown) => void;
  readonly onFailed?: (data: unknown) => void;
  /**
   * Called when a previously established stream can no longer reconnect.
   * Initial connection exhaustion is thrown directly from connect().
   */
  readonly onExhausted?: (error: SSEExhaustedError) => void;
}

/**
 * Configuration options for SSEClient.
 */
export interface SSEClientOptions {
  /** Maximum connection attempts before throwing SSEExhaustedError. Default: 3 */
  readonly maxRetries?: number;
  /** Base delay in ms between retries (doubles each attempt). Default: 1000 */
  readonly retryBaseMs?: number;
}

/**
 * Connection-scoped options for SSE connect calls.
 */
export interface SSEConnectOptions {
  /** Optional abort signal for connect/reconnect attempts. */
  readonly signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Thrown when SSE connection fails after all retry attempts.
 * Callers should catch this and fall back to polling.
 */
export class SSEExhaustedError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "SSEExhaustedError";
    this.cause = cause;
  }
}

// ---------------------------------------------------------------------------
// SSEClient
// ---------------------------------------------------------------------------

/**
 * SSE client with retry and graceful degradation.
 *
 * @example
 * ```typescript
 * const client = new SSEClient({ maxRetries: 3 });
 * try {
 *   const unsub = await client.connect(streamUrl, {
 *     onCompleted: (data) => console.log('done', data),
 *   });
 *   // later...
 *   unsub();
 * } catch (err) {
 *   if (err instanceof SSEExhaustedError) {
 *     // fall back to polling
 *   }
 * }
 * ```
 */
export class SSEClient {
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;

  constructor(options: SSEClientOptions = {}) {
    this.maxRetries = options.maxRetries ?? 3;
    this.retryBaseMs = options.retryBaseMs ?? 1000;
  }

  /**
   * Connect to an SSE stream and dispatch events to handlers.
   *
   * Returns an unsubscribe function. Throws `SSEExhaustedError` after
   * `maxRetries` failed initial connection attempts.
   *
   * After an initial successful connection, mid-stream disconnects trigger
   * reconnect attempts. If those are exhausted, `handlers.onExhausted` is called.
   *
   * @param url - The SSE stream URL
   * @param handlers - Event handlers for each SSE event type
   * @param options - Optional signal for aborting connection attempts
   * @returns Promise resolving to an unsubscribe function
   * @throws SSEExhaustedError if initial connection retries are exhausted
   */
  async connect(
    url: string,
    handlers: SSEHandlers,
    options: SSEConnectOptions = {},
  ): Promise<() => void> {
    let cancelled = false;
    let reconnecting = false;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let controller: AbortController | undefined;

    const unsubscribe = (): void => {
      cancelled = true;
      controller?.abort();
      reader?.cancel().catch(() => {
        // Ignore cancel errors — stream may already be closed.
      });
    };

    if (options.signal?.aborted) {
      throw new Error("Aborted");
    }

    const startReadLoop = (): void => {
      const activeReader = reader;
      if (!activeReader) return;

      void (async () => {
        const decoder = new TextDecoder();
        let buffer = "";
        let terminalEventReceived = false;

        while (!cancelled) {
          const { done, value } = await activeReader.read();
          if (done) {
            if (!cancelled && !terminalEventReceived) {
              throw new Error("SSE stream disconnected");
            }
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          terminalEventReceived = this.processLines(lines, handlers) || terminalEventReceived;
        }
      })().catch((error: unknown) => {
        if (cancelled || options.signal?.aborted || reconnecting) {
          return;
        }

        reconnecting = true;
        void this.connectWithRetry(url, options, error, {
          onConnected: (nextReader, nextController) => {
            reader = nextReader;
            controller = nextController;
            reconnecting = false;
            startReadLoop();
          },
          onExhausted: (exhaustedError) => {
            reconnecting = false;
            handlers.onExhausted?.(exhaustedError);
            unsubscribe();
          },
          isCancelled: () => cancelled,
        }).catch(() => {
          reconnecting = false;
        });
      });
    };

    const initial = await this.connectWithRetry(url, options, undefined, {
      onConnected: (nextReader, nextController) => {
        reader = nextReader;
        controller = nextController;
      },
      onExhausted: (error) => {
        throw error;
      },
      isCancelled: () => cancelled,
    });

    // Ensure initial reader/controller are used to begin streaming.
    reader = initial.reader;
    controller = initial.controller;
    startReadLoop();

    return unsubscribe;
  }

  private async connectWithRetry(
    url: string,
    options: SSEConnectOptions,
    initialCause: unknown,
    hooks: {
      readonly onConnected: (
        reader: ReadableStreamDefaultReader<Uint8Array>,
        controller: AbortController,
      ) => void;
      readonly onExhausted: (error: SSEExhaustedError) => void;
      readonly isCancelled: () => boolean;
    },
  ): Promise<{
    readonly reader: ReadableStreamDefaultReader<Uint8Array>;
    readonly controller: AbortController;
  }> {
    let attempt = 0;
    let lastError = initialCause;

    // For reconnects after an established stream disconnect, apply backoff
    // before the first reconnect attempt to avoid tight reconnect loops.
    if (initialCause !== undefined) {
      await delay(this.retryBaseMs, options.signal);
    }

    while (!hooks.isCancelled()) {
      if (options.signal?.aborted) {
        throw new Error("Aborted");
      }

      const controller = new AbortController();
      const mergedSignal = mergeAbortSignals(controller.signal, options.signal);

      try {
        const response = await fetch(url, {
          headers: { Accept: "text/event-stream" },
          signal: mergedSignal.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`SSE connect failed: ${response.status}`);
        }

        const nextReader = response.body.getReader();
        hooks.onConnected(nextReader, controller);
        return { reader: nextReader, controller };
      } catch (error) {
        if (hooks.isCancelled() || options.signal?.aborted || controller.signal.aborted) {
          throw new Error("Aborted");
        }

        lastError = error;
        attempt += 1;

        if (attempt >= this.maxRetries) {
          const exhaustedError = new SSEExhaustedError(
            `SSE failed after ${this.maxRetries} attempts`,
            lastError,
          );
          hooks.onExhausted(exhaustedError);
          throw exhaustedError;
        }

        await delay(this.retryBaseMs * 2 ** (attempt - 1), options.signal);
      } finally {
        mergedSignal.cleanup();
      }
    }

    throw new Error("Aborted");
  }

  /**
   * Parse SSE lines and dispatch events to handlers.
   * Handles the SSE wire format: event/data/blank-line protocol.
   */
  private processLines(lines: string[], handlers: SSEHandlers): boolean {
    let eventType = "";
    let dataBuffer = "";
    let terminalEventReceived = false;

    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataBuffer = line.slice(5).trim();
      } else if (line === "") {
        // Blank line signals end of event — dispatch if we have both type and data
        if (eventType && dataBuffer) {
          const parsed = safeParseJson(dataBuffer);
          terminalEventReceived =
            this.dispatch(eventType, parsed, handlers) || terminalEventReceived;
        }
        eventType = "";
        dataBuffer = "";
      }
    }

    return terminalEventReceived;
  }

  /**
   * Dispatch a parsed SSE event to the appropriate handler.
   */
  private dispatch(type: string, data: unknown, handlers: SSEHandlers): boolean {
    switch (type) {
      case "status_update":
        handlers.onStatusUpdate?.(data);
        return false;
      case "progress":
        handlers.onProgress?.(data);
        return false;
      case "completed":
        handlers.onCompleted?.(data);
        return true;
      case "failed":
        handlers.onFailed?.(data);
        return true;
      // Unknown event types are silently ignored
      default:
        return false;
    }
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function mergeAbortSignals(
  primary: AbortSignal,
  secondary?: AbortSignal,
): {
  readonly signal: AbortSignal;
  readonly cleanup: () => void;
} {
  if (!secondary) {
    return { signal: primary, cleanup: () => {} };
  }

  const controller = new AbortController();

  const onAbort = (): void => {
    controller.abort();
  };

  if (primary.aborted || secondary.aborted) {
    controller.abort();
  } else {
    primary.addEventListener("abort", onAbort, { once: true });
    secondary.addEventListener("abort", onAbort, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      primary.removeEventListener("abort", onAbort);
      secondary.removeEventListener("abort", onAbort);
    },
  };
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  const waitMs = Math.max(0, ms);
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, waitMs);

    const onAbort = (): void => {
      clearTimeout(timeoutId);
      reject(new Error("Aborted"));
    };

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

function safeParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
