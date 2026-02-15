/**
 * Callback server for receiving push deliveries from Providers.
 *
 * Implements a lightweight HTTP server that listens for incoming
 * push deliveries at POST /ivxp/callback. Validates content integrity
 * by comparing the SHA-256 hash of delivered content against the
 * provided content_hash field.
 *
 * Features:
 * - Configurable port (default: 0 for OS-assigned)
 * - Optional TLS support via cert/key options
 * - POST-only /ivxp/callback route (404 for all others)
 * - JSON body parsing with 1MB size limit
 * - Content hash verification (SHA-256)
 * - Graceful shutdown with connection draining
 *
 * All Node.js module imports use dynamic `import()` so the SDK
 * remains type-checkable without `@types/node`.
 *
 * @see Story 3.13 - FR-C6: Receive Push Delivery
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum body size in bytes (1MB). */
const MAX_BODY_SIZE = 1024 * 1024;

/** The callback endpoint path. */
const CALLBACK_PATH = "/ivxp/callback";

// ---------------------------------------------------------------------------
// Lightweight types for Node.js HTTP/crypto APIs
//
// Defined inline to avoid a hard dependency on @types/node.
// Only the subset of methods/properties actually used is declared.
// ---------------------------------------------------------------------------

/** Minimal IncomingMessage shape (subset of node:http.IncomingMessage). */
interface IncomingMsg {
  readonly method?: string;
  readonly url?: string;
  on(event: "data", listener: (chunk: Uint8Array) => void): void;
  on(event: "end", listener: () => void): void;
  on(event: "error", listener: (err: Error) => void): void;
  destroy(): void;
}

/** Minimal ServerResponse shape (subset of node:http.ServerResponse). */
interface ServerRes {
  readonly headersSent: boolean;
  writeHead(statusCode: number, headers?: Record<string, string>): void;
  end(data?: string): void;
}

/** Minimal Server shape (subset of node:http.Server). */
interface HttpServer {
  listen(port: number, host: string, callback: () => void): void;
  address(): { port: number } | string | null;
  close(callback: () => void): void;
  on(event: "error", listener: (err: Error) => void): void;
}

// ---------------------------------------------------------------------------
// Public Types
// ---------------------------------------------------------------------------

/**
 * Configuration for the callback server.
 */
export interface CallbackServerOptions {
  /** Port to bind to. Default: 0 (OS-assigned). */
  readonly port?: number;

  /** Host to bind to. Default: '127.0.0.1'. */
  readonly host?: string;

  /** Optional TLS configuration for HTTPS. */
  readonly tls?: {
    readonly cert: string;
    readonly key: string;
  };
}

/**
 * Result of creating a callback server.
 *
 * Contains the server reference, the full callback URL,
 * the assigned port, and a stop function for graceful shutdown.
 */
export interface CallbackServerResult {
  /** The underlying HTTP/HTTPS server instance. */
  readonly server: unknown;

  /** The full callback URL (e.g., 'http://127.0.0.1:3456/ivxp/callback'). */
  readonly url: string;

  /** The port the server is listening on. */
  readonly port: number;

  /** Stop the server gracefully, draining pending connections. */
  readonly stop: () => Promise<void>;
}

/**
 * Structured details about a rejected delivery.
 *
 * Provides the reason string along with the expected and computed
 * content hashes, eliminating the need to parse hashes from the
 * reason string.
 */
export interface RejectionDetails {
  /** Human-readable rejection reason. */
  readonly reason: string;

  /** The expected content hash (from the payload, without sha256: prefix). */
  readonly expectedHash: string;

  /** The computed SHA-256 hash of the delivered content. */
  readonly computedHash: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Read the request body with a size limit.
 *
 * Accumulates chunks from the request stream until the stream ends
 * or the size limit is exceeded. Returns the raw body string.
 *
 * Uses a `settled` flag to prevent multiple resolve/reject calls
 * when `req.destroy()` triggers both error and end events after
 * the size limit is exceeded.
 *
 * @param req - The incoming HTTP request
 * @param maxBytes - Maximum body size in bytes
 * @returns The raw body string
 * @throws Error if the body exceeds the size limit
 */
function readBody(req: IncomingMsg, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let totalSize = 0;
    // Prevents double-settle: after req.destroy(), both 'end' and 'error'
    // events may fire. Without this flag, the Promise would attempt to
    // resolve/reject multiple times.
    let settled = false;

    req.on("data", (chunk: Uint8Array) => {
      if (settled) return;
      totalSize += chunk.length;
      if (totalSize > maxBytes) {
        settled = true;
        req.destroy();
        reject(new Error("Body exceeds size limit"));
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (settled) return;
      settled = true;
      // Concatenate chunks into a single string
      const decoder = new TextDecoder("utf-8");
      const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      resolve(decoder.decode(combined));
    });

    req.on("error", (err: Error) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
  });
}

/**
 * Verify that the content_hash matches the delivered content.
 *
 * Computes SHA-256 hash of the content and compares with the
 * expected hash from the payload. Handles both prefixed
 * (sha256:abc...) and non-prefixed (abc...) hash formats.
 *
 * Uses the Web Crypto API via a synchronous Node.js crypto fallback.
 *
 * @param content - The delivered content to hash
 * @param expectedHash - The expected content_hash value
 * @param cryptoCreateHash - Injected createHash function from node:crypto
 * @returns Object with match result and computed/expected hashes
 */
function verifyContentHash(
  content: string,
  expectedHash: string,
  cryptoCreateHash: (algorithm: string) => {
    update(data: string): { digest(encoding: string): string };
  },
): { readonly match: boolean; readonly computed: string; readonly expected: string } {
  const computed = cryptoCreateHash("sha256").update(content).digest("hex");
  const expected = expectedHash.replace(/^sha256:/, "");

  return {
    match: computed === expected,
    computed,
    expected,
  };
}

/**
 * Validate that the push delivery payload has the required structure.
 *
 * Checks for the presence of required fields without using Zod to
 * keep the callback server lightweight. The full schema validation
 * is the Provider's responsibility before sending.
 *
 * @param payload - The parsed JSON payload
 * @returns true if the payload has the required structure
 */
function isValidPayload(payload: unknown): payload is {
  readonly order_id: string;
  readonly status: string;
  readonly deliverable: {
    readonly content: string;
    readonly content_hash: string;
    readonly format: string;
  };
} {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const p = payload as Record<string, unknown>;

  if (typeof p.order_id !== "string") {
    return false;
  }

  if (typeof p.deliverable !== "object" || p.deliverable === null) {
    return false;
  }

  const d = p.deliverable as Record<string, unknown>;

  return (
    typeof d.content === "string" &&
    typeof d.content_hash === "string" &&
    typeof d.format === "string"
  );
}

/**
 * Handle an incoming HTTP request on the callback server.
 *
 * Routes only POST /ivxp/callback. All other methods and paths
 * receive a 404 response. Parses JSON body, validates the payload
 * structure, verifies content hash, and invokes the appropriate
 * callback (onDelivery or onRejected).
 */
async function handleRequest(
  req: IncomingMsg,
  res: ServerRes,
  onDelivery: (payload: unknown) => void,
  onRejected: (details: RejectionDetails, payload: unknown) => void,
  cryptoCreateHash: (algorithm: string) => {
    update(data: string): { digest(encoding: string): string };
  },
): Promise<void> {
  // Only accept POST to /ivxp/callback
  if (req.method !== "POST" || req.url !== CALLBACK_PATH) {
    res.writeHead(404);
    res.end();
    return;
  }

  // Read body with size limit
  let rawBody: string;
  try {
    rawBody = await readBody(req, MAX_BODY_SIZE);
  } catch {
    res.writeHead(413, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Payload too large" }));
    return;
  }

  // Parse JSON
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON" }));
    return;
  }

  // Validate payload structure
  if (!isValidPayload(payload)) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid payload: missing required fields" }));
    return;
  }

  // Verify content hash
  const verification = verifyContentHash(
    payload.deliverable.content,
    payload.deliverable.content_hash,
    cryptoCreateHash,
  );

  if (!verification.match) {
    const reason = `content_hash mismatch: expected ${verification.expected}, computed ${verification.computed}`;
    onRejected(
      { reason, expectedHash: verification.expected, computedHash: verification.computed },
      payload,
    );
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "content_hash mismatch" }));
    return;
  }

  // Delivery accepted
  onDelivery(payload);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "received" }));
}

// ---------------------------------------------------------------------------
// createCallbackServer
// ---------------------------------------------------------------------------

/**
 * Create and start a callback server for receiving push deliveries.
 *
 * The server binds to the specified port and host, and routes only
 * POST requests to /ivxp/callback. All other requests receive a
 * 404 response.
 *
 * Requires Node.js runtime (uses `node:http` and `node:crypto`).
 *
 * @param onDelivery - Callback invoked when a valid delivery is received
 * @param onRejected - Callback invoked when a delivery is rejected (hash mismatch)
 * @param options - Server configuration options
 * @returns A result object with the server, URL, port, and stop function
 */
export async function createCallbackServer(
  onDelivery: (payload: unknown) => void,
  onRejected: (details: RejectionDetails, payload: unknown) => void,
  options: CallbackServerOptions = {},
): Promise<CallbackServerResult> {
  const { port = 0, host = "127.0.0.1", tls } = options;

  // Dynamic imports for Node.js modules to avoid requiring @types/node
  const httpModule = "node:http";
  const cryptoModule = "node:crypto";
  const http = (await import(/* @vite-ignore */ httpModule)) as {
    createServer: (handler: (req: IncomingMsg, res: ServerRes) => void) => HttpServer;
  };
  const crypto = (await import(/* @vite-ignore */ cryptoModule)) as {
    createHash: (algorithm: string) => {
      update(data: string): { digest(encoding: string): string };
    };
  };

  // For TLS, dynamically import node:https
  let httpsModule:
    | {
        createServer: (
          options: { cert: string; key: string },
          handler: (req: IncomingMsg, res: ServerRes) => void,
        ) => HttpServer;
      }
    | undefined;

  if (tls) {
    const httpsModuleName = "node:https";
    httpsModule = (await import(/* @vite-ignore */ httpsModuleName)) as typeof httpsModule;
  }

  return new Promise((resolve, reject) => {
    const requestHandler = (req: IncomingMsg, res: ServerRes): void => {
      handleRequest(req, res, onDelivery, onRejected, crypto.createHash).catch((error: unknown) => {
        // Log the error so it is not silently swallowed.
        console.error("Unexpected error in callback server request handler:", error);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Internal server error" }));
        }
      });
    };

    const server: HttpServer =
      tls && httpsModule
        ? httpsModule.createServer({ cert: tls.cert, key: tls.key }, requestHandler)
        : http.createServer(requestHandler);

    // Reject the Promise if the server fails to start (e.g. port in use,
    // permission denied). Without this handler the Promise would hang
    // forever because the listen callback would never fire.
    server.on("error", (err: Error) => {
      reject(err);
    });

    // `stopped` is intentionally mutable local state within this closure.
    // It guards the idempotent stop() function that manages the server's
    // lifecycle. This is acceptable because it is scoped entirely within
    // the closure and never escapes as shared/external state.
    let stopped = false;

    const stop = (): Promise<void> => {
      if (stopped) {
        return Promise.resolve();
      }
      stopped = true;
      return new Promise((resolveStop) => {
        server.close(() => resolveStop());
      });
    };

    server.listen(port, host, () => {
      const addr = server.address();
      const assignedPort = typeof addr === "object" && addr !== null ? addr.port : port;
      const protocol = tls ? "https" : "http";

      resolve({
        server,
        url: `${protocol}://${host}:${assignedPort}${CALLBACK_PATH}`,
        port: assignedPort,
        stop,
      });
    });
  });
}
