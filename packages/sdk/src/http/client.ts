/**
 * HttpClient -- HTTP client implementation with IVXP error handling.
 *
 * Uses native fetch (Node.js 20+) to make HTTP requests.
 * Implements the IHttpClient interface from @ivxp/protocol.
 *
 * Features:
 * - JSON request/response handling with Content-Type validation
 * - HTTP status code to IVXPError subclass mapping
 * - Configurable timeout with AbortSignal composition
 * - Dependency injection via interface for testing
 * - Factory function for convenient instantiation
 */

import type { IHttpClient, JsonSerializable, RequestOptions } from "@ivxp/protocol";
import { IVXPError } from "../errors/base.js";
import {
  SignatureVerificationError,
  PaymentVerificationError,
  OrderNotFoundError,
  ServiceUnavailableError,
} from "../errors/specific.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default request timeout in milliseconds. */
const DEFAULT_TIMEOUT_MS = 30_000;

/** Content-Type prefix for JSON responses. */
const JSON_CONTENT_TYPE = "application/json";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Configuration options for the HttpClient.
 */
export interface HttpClientOptions {
  /** Base URL to prepend to all request URLs. */
  readonly baseUrl?: string;
  /** Default headers to include with every request. */
  readonly headers?: Readonly<Record<string, string>>;
  /** Default timeout in milliseconds. Defaults to 30000ms. */
  readonly timeout?: number;
}

// ---------------------------------------------------------------------------
// HttpClient
// ---------------------------------------------------------------------------

/**
 * HTTP client with IVXP-specific error handling.
 *
 * Maps HTTP error status codes to specific IVXPError subclasses:
 * - 401 -> SignatureVerificationError
 * - 402 -> PaymentVerificationError
 * - 404 -> OrderNotFoundError
 * - 5xx -> ServiceUnavailableError
 * - Other -> IVXPError with HTTP_<status> code
 *
 * Supports configurable base URL, default headers, timeout,
 * and external AbortSignal for request cancellation.
 */
export class HttpClient implements IHttpClient {
  private readonly baseUrl: string;
  private readonly defaultHeaders: Readonly<Record<string, string>>;
  private readonly defaultTimeout: number;

  constructor(options: HttpClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? "";
    this.defaultHeaders = {
      "Content-Type": "application/json",
      ...options.headers,
    };
    this.defaultTimeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * Send an HTTP GET request.
   *
   * **Note:** The response body is parsed as JSON but not validated at runtime
   * against the type parameter T. Callers should validate the response shape
   * if the upstream API is not fully trusted. Runtime schema validation is
   * planned for a future story.
   *
   * @typeParam T - Expected response body type (not validated at runtime)
   * @param url - The URL to request (prepended with baseUrl if configured)
   * @param options - Optional request configuration
   * @returns Parsed JSON response body of type T
   * @throws IVXPError subclass for HTTP errors
   * @throws ServiceUnavailableError for timeouts and network errors
   */
  async get<T>(url: string, options?: RequestOptions): Promise<T> {
    return this.request<T>("GET", url, undefined, options);
  }

  /**
   * Send an HTTP POST request.
   *
   * **Note:** The response body is parsed as JSON but not validated at runtime
   * against the type parameter T. Callers should validate the response shape
   * if the upstream API is not fully trusted. Runtime schema validation is
   * planned for a future story.
   *
   * @typeParam T - Expected response body type (not validated at runtime)
   * @param url - The URL to request (prepended with baseUrl if configured)
   * @param body - Request body (must be JSON-serializable)
   * @param options - Optional request configuration
   * @returns Parsed JSON response body of type T
   * @throws IVXPError subclass for HTTP errors
   * @throws ServiceUnavailableError for timeouts and network errors
   */
  async post<T>(url: string, body: JsonSerializable, options?: RequestOptions): Promise<T> {
    return this.request<T>("POST", url, body, options);
  }

  // -------------------------------------------------------------------------
  // Private methods
  // -------------------------------------------------------------------------

  private async request<T>(
    method: "GET" | "POST",
    url: string,
    body?: JsonSerializable,
    options?: RequestOptions,
  ): Promise<T> {
    const fullUrl = this.baseUrl ? `${this.baseUrl}${url}` : url;

    // Create abort controller for timeout. When an external signal is
    // provided, forward its abort to the internal controller so that
    // fetch always uses a single signal (controller.signal) that fires
    // for both timeout and external cancellation.
    const controller = new AbortController();
    const timeout = options?.timeout ?? this.defaultTimeout;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Compose external signal: if caller provided one, forward its abort
    // to our internal controller so fetch sees a single unified signal.
    const externalSignal = options?.signal;
    let onExternalAbort: (() => void) | undefined;
    if (externalSignal) {
      if (externalSignal.aborted) {
        // Already aborted before we even start
        controller.abort();
      } else {
        onExternalAbort = () => controller.abort();
        externalSignal.addEventListener("abort", onExternalAbort);
      }
    }

    try {
      const response = await fetch(fullUrl, {
        method,
        headers: {
          ...this.defaultHeaders,
          ...options?.headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      return this.parseResponseBody<T>(response);
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof IVXPError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new ServiceUnavailableError(
          `Request timeout: ${method} ${fullUrl} after ${timeout}ms`,
        );
      }

      throw new ServiceUnavailableError(
        `HTTP request failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      // Clean up external signal listener to prevent memory leaks
      if (externalSignal && onExternalAbort) {
        externalSignal.removeEventListener("abort", onExternalAbort);
      }
    }
  }

  /**
   * Parse the response body as JSON with Content-Type validation.
   *
   * Returns undefined (cast to T) for empty responses (e.g. 204 No Content).
   * Throws ServiceUnavailableError if the Content-Type is not application/json
   * and the body is non-empty, preventing confusing parse errors from HTML
   * error pages returned by CDN/proxy layers.
   */
  private async parseResponseBody<T>(response: Response): Promise<T> {
    const text = await response.text();

    if (text.length === 0) {
      return undefined as T;
    }

    const contentType = response.headers.get("Content-Type") ?? "";
    if (contentType.length > 0 && !contentType.includes(JSON_CONTENT_TYPE)) {
      throw new ServiceUnavailableError(
        `Expected JSON response but received Content-Type: ${contentType}`,
      );
    }

    return JSON.parse(text) as T;
  }

  /**
   * Map an HTTP error response to the appropriate IVXPError subclass.
   *
   * Attempts to parse the response body as JSON to extract an error message.
   * Falls back to the HTTP status text if the body is not valid JSON or
   * does not contain a string message field.
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    const errorBody = await response.json().catch(() => ({}));
    const rawMessage = (errorBody as Record<string, unknown>).message;
    const message = typeof rawMessage === "string" ? rawMessage : response.statusText;

    switch (response.status) {
      case 401:
        throw new SignatureVerificationError(message);
      case 402:
        throw new PaymentVerificationError(message);
      case 404:
        throw new OrderNotFoundError(message);
      default:
        if (response.status >= 500) {
          throw new ServiceUnavailableError(message);
        }
        throw new IVXPError(message, `HTTP_${response.status}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Factory function
// ---------------------------------------------------------------------------

/**
 * Create a new HttpClient instance.
 *
 * Factory function that returns an IHttpClient-typed instance,
 * hiding the concrete HttpClient class behind the interface.
 *
 * @param options - Optional client configuration
 * @returns An IHttpClient implementation
 */
export function createHttpClient(options?: HttpClientOptions): IHttpClient {
  return new HttpClient(options);
}
